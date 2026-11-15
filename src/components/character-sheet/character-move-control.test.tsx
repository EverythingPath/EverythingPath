import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { useState } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CharacterMoveControl } from './character-move-control';
import type { useCharacterMove } from './use-character-move';

// The owner's Add, Move and Leave campaign in the sheet's campaign row
// (#316), driven by hand-built controller states: the controller's own
// rules (eligibility, operation identity, stale replies) are covered by
// use-character-move.test.ts.

type Movement = ReturnType<typeof useCharacterMove>;
type Progress = NonNullable<Movement['progress']>;
const rustedHill = 'rusted-hill' as Id<'campaign'>;
const kingmaker = 'kingmaker' as Id<'campaign'>;
const thornkeep = 'thornkeep' as Id<'campaign'>;
const leaveText =
  'Leaving removes this character from the militia roster and officer and manager assignments. Its sheet and homebrew stay with it.';

const handlers = {
  startMove: vi.fn<Movement['startMove']>(),
  resumeMove: vi.fn<Movement['resumeMove']>(),
  cancelMove: vi.fn<Movement['cancelMove']>(),
  retryRead: vi.fn<Movement['retryRead']>(),
};

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    isAvailable: true,
    isLoading: false,
    isDisabled: false,
    isBusy: false,
    canStart: true,
    canReviewMove: overrides.canStart ?? true,
    canResume: false,
    canCancel: false,
    canLeave: true,
    currentCampaignId: rustedHill,
    groupPreview: null,
    currentCampaignHasMilitia: true,
    departureRoles: [],
    pendingDestinationCampaignId: undefined,
    isPickerOpen: false,
    setIsPickerOpen: () => undefined,
    destinations: [
      {
        campaignId: kingmaker,
        campaignName: 'Kingmaker',
        organizationId: 'o',
        hasMilitia: true,
      },
      {
        campaignId: thornkeep,
        campaignName: 'Thornkeep',
        organizationId: 'p',
        hasMilitia: false,
      },
    ],
    status: { kind: 'idle' },
    progress: null,
    replacedMove: null,
    needsInspection: false,
    operatorStatus: null,
    readError: null,
    ...handlers,
    ...overrides,
  };
}
function progress(
  state: Progress['state'],
  prepared = 2,
  rest: Partial<Progress> = {},
): Progress {
  return {
    generation: 0,
    operationId: 'op-1',
    state,
    prepared,
    total: 6,
    ...rest,
  };
}
const pending = {
  canStart: false,
  canLeave: false,
  canResume: true,
  canCancel: true,
} as const;

// The picker's open state lives with the controller; a saved start closes it.
// `afterStart` is the controller once a start is saved.
function Host({
  state: initial,
  afterStart,
  isMilitiaOnly,
}: {
  state: Movement;
  afterStart?: Movement;
  isMilitiaOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const state = started && afterStart ? afterStart : initial;
  return (
    <CharacterMoveControl
      characterName="Vessa"
      campaignName="Rusted Hill"
      isMilitiaOnly={isMilitiaOnly}
      movement={{
        ...state,
        isPickerOpen: isOpen,
        setIsPickerOpen: (open) => setIsOpen(open && state.canReviewMove),
        startMove: async (...destination) => {
          const saved = await state.startMove(...destination);
          if (saved) {
            setIsOpen(false);
            setStarted(true);
          }
          return saved;
        },
      }}
    />
  );
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const announced = () =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent)
    .join(' ');

beforeEach(() => {
  vi.clearAllMocks();
  handlers.startMove.mockResolvedValue(true);
  handlers.resumeMove.mockResolvedValue(true);
  handlers.cancelMove.mockResolvedValue(true);
  handlers.retryRead.mockResolvedValue(undefined);
});

test('nothing moves before eligibility is known, for anyone else, or during maintenance; the owner sees the entry points for where the character is', () => {
  const view = render(
    <Host state={movement({ isAvailable: false, isLoading: true })} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading campaign choices…',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();

  view.rerender(<Host state={movement({ isLoading: true })} />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading move progress…',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();

  // Someone else's, or an ineligible production Character.
  view.rerender(<Host state={movement({ isAvailable: false })} />);
  expect(view.container).toBeEmptyDOMElement();

  // Maintenance or a save in flight: shown, not usable.
  view.rerender(
    <Host
      state={movement({ isDisabled: true, canStart: false, canLeave: false })}
    />,
  );
  expect(button('Move to campaign')).toBeDisabled();
  expect(button('Leave campaign')).toBeDisabled();

  view.rerender(<Host state={movement({ currentCampaignId: undefined })} />);
  expect(button('Add to campaign')).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Leave campaign' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(leaveText)).not.toBeInTheDocument();

  view.rerender(<Host state={movement()} />);
  expect(button('Move to campaign')).toBeEnabled();
  expect(button('Leave campaign')).toHaveAccessibleDescription(leaveText);
  expect(screen.queryByText(/Full character/)).not.toBeInTheDocument();

  view.rerender(<Host state={movement()} isMilitiaOnly />);
  expect(button('Leave campaign')).toHaveAccessibleDescription(
    `${leaveText} As a Militia-only character it becomes a Full character, which can’t be undone.`,
  );
});

test('the picker is a named dialog of the other campaigns as cards; an empty list reads plainly and closing returns focus to its trigger', async () => {
  const view = render(<Host state={movement()} />);
  fireEvent.click(button('Move to campaign'));
  const picker = within(
    screen.getByRole('dialog', { name: 'Move to campaign' }),
  );
  expect(picker.getByRole('radiogroup', { name: 'Campaigns' })).toBeVisible();
  expect(
    picker
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent),
  ).toEqual(['Kingmaker', 'Thornkeep']);
  expect(picker.queryByRole('radio', { name: /Rusted Hill/ })).toBeNull();
  expect(
    screen.getByRole('dialog', { name: 'Move to campaign' }),
  ).toHaveAccessibleDescription(
    /Vessa leaves Rusted Hill when the move completes/,
  );
  // Nothing is submitted without a choice.
  expect(picker.getByRole('button', { name: 'Move character' })).toBeDisabled();

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(button('Move to campaign')).toHaveFocus());
  expect(handlers.startMove).not.toHaveBeenCalled();

  view.rerender(<Host state={movement({ destinations: [] })} />);
  fireEvent.click(button('Move to campaign'));
  const empty = within(screen.getByRole('dialog'));
  expect(empty.getByText('No other campaigns are available.')).toBeVisible();
  expect(empty.queryByRole('radio')).toBeNull();
  expect(empty.getByRole('button', { name: 'Move character' })).toBeDisabled();
});

test('joining saves the chosen campaign once, acknowledged in the picker while pending; leaving starts a move to no campaign', async () => {
  let save!: (saved: boolean) => void;
  handlers.startMove.mockReturnValue(
    new Promise((resolve) => {
      save = resolve;
    }),
  );
  const private_ = movement({ currentCampaignId: undefined, canLeave: false });
  const view = render(<Host state={private_} />);
  fireEvent.click(button('Add to campaign'));
  const dialog = screen.getByRole('dialog', { name: 'Add to campaign' });
  const picker = within(dialog);
  expect(dialog).toHaveAccessibleDescription(/isn’t added to a militia roster/);
  fireEvent.click(picker.getByRole('radio', { name: 'Thornkeep' }));
  fireEvent.click(picker.getByRole('button', { name: 'Join campaign' }));
  expect(handlers.startMove).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).toHaveBeenCalledWith(thornkeep);

  // The controller reports the save; duplicates are refused until it lands.
  view.rerender(
    <Host
      state={{
        ...private_,
        isBusy: true,
        isDisabled: true,
        canStart: false,
        status: { kind: 'saving' },
      }}
    />,
  );
  expect(picker.getByRole('button', { name: 'Join campaign' })).toBeDisabled();
  expect(picker.getByRole('radio', { name: 'Thornkeep' })).toBeDisabled();
  expect(picker.getByRole('status')).toHaveTextContent('Saving move…');
  expect(screen.queryByText(/Added to campaign/)).not.toBeInTheDocument();
  await act(async () => save(true));
  expect(handlers.startMove).toHaveBeenCalledTimes(1);

  view.unmount();
  handlers.startMove.mockResolvedValue(true);
  render(<Host state={movement()} />);
  fireEvent.click(button('Leave campaign'));
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave campaign',
      }),
    );
  });
  expect(handlers.startMove).toHaveBeenCalledTimes(2);
  expect(handlers.startMove).toHaveBeenLastCalledWith();
});

test('a saved start hands focus to its progress, from the picker or from Leave campaign', async () => {
  const preparing = movement({
    progress: progress('preparing'),
    status: { kind: 'saved' },
    canStart: false,
    canLeave: false,
    canResume: true,
    canCancel: true,
  });
  const view = render(<Host state={movement()} afterStart={preparing} />);
  fireEvent.click(button('Move to campaign'));
  const picker = within(screen.getByRole('dialog'));
  fireEvent.click(picker.getByRole('radio', { name: 'Kingmaker' }));
  await act(async () => {
    fireEvent.click(picker.getByRole('button', { name: 'Move character' }));
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(button('Continue move')).toHaveFocus());
  view.unmount();

  render(<Host state={movement()} afterStart={preparing} />);
  button('Leave campaign').focus();
  fireEvent.click(button('Leave campaign'));
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave campaign',
      }),
    );
  });
  expect(button('Continue move')).toHaveFocus();
});

test('preparing, ready and completed are distinct: progress continues and publishes, and only a finished move says so', async () => {
  const view = render(
    <Host
      state={movement({
        progress: progress('preparing'),
        status: { kind: 'saved' },
        canStart: false,
        canLeave: false,
        canResume: true,
        canCancel: true,
      })}
    />,
  );
  const panel = within(screen.getByRole('region', { name: 'Move progress' }));
  expect(panel.getByText('Preserving homebrew…')).toBeVisible();
  const bar = panel.getByRole('progressbar', { name: 'Homebrew preserved' });
  expect(bar).toHaveAttribute('aria-valuenow', '2');
  expect(bar).toHaveAttribute('aria-valuemax', '6');
  // The old campaign stays authoritative: no entry points, no success.
  expect(screen.queryByRole('button', { name: /campaign/ })).toBeNull();
  expect(announced()).not.toMatch(/moved|Added|Left/);
  fireEvent.click(panel.getByRole('button', { name: 'Continue move' }));
  expect(handlers.resumeMove).toHaveBeenCalledTimes(1);
  fireEvent.click(panel.getByRole('button', { name: 'Cancel move' }));
  expect(handlers.cancelMove).toHaveBeenCalledTimes(1);

  view.rerender(
    <Host
      state={movement({
        progress: progress('ready', 6),
        status: { kind: 'saved' },
        canStart: false,
        canLeave: false,
        canResume: true,
        canCancel: true,
      })}
    />,
  );
  expect(screen.getByText('Ready to move')).toBeVisible();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(announced()).not.toMatch(/moved/);
  fireEvent.click(button('Complete move'));
  expect(handlers.resumeMove).toHaveBeenCalledTimes(2);

  // Published: the live projection now names the destination.
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(screen.queryByRole('region', { name: 'Move progress' })).toBeNull();
  expect(announced()).toBe(
    'Character moved. Add this character to the militia roster separately.',
  );
  expect(button('Move to campaign')).toBeEnabled();
});

test('a join and a departure each name their result; a move finished before the sheet opened, or cancelled, says only that', () => {
  const pending = movement({
    currentCampaignId: undefined,
    progress: progress('ready', 6),
    canStart: false,
    canResume: true,
  });
  const view = render(<Host state={pending} />);
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(announced()).toBe(
    'Added to campaign. Add this character to the militia roster separately.',
  );
  view.unmount();

  const leaving = render(
    <Host
      state={movement({ progress: progress('ready', 6), canStart: false })}
    />,
  );
  leaving.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: undefined,
      })}
    />,
  );
  expect(announced()).toBe('Left campaign.');
  expect(button('Add to campaign')).toBeEnabled();
  leaving.unmount();

  const cancelled = render(
    <Host
      state={movement({ progress: progress('preparing'), canStart: false })}
    />,
  );
  cancelled.rerender(
    <Host
      state={movement({
        progress: progress('cancelled'),
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(announced()).toBe(
    'Move cancelled. Your character stays in its current campaign.',
  );
  expect(button('Move to campaign')).toBeEnabled();
  cancelled.unmount();

  render(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(announced()).toBe('');
});

test('a refusal is an alert beside the picker that keeps the choice; an uncertain reply offers Check progress, never a new move', async () => {
  const view = render(<Host state={movement()} />);
  fireEvent.click(button('Move to campaign'));
  const picker = within(screen.getByRole('dialog'));
  fireEvent.click(picker.getByRole('radio', { name: 'Kingmaker' }));
  const refused = "Move wasn't saved: Choose a different campaign. Try again.";
  handlers.startMove.mockResolvedValue(false);
  await act(async () => {
    fireEvent.click(picker.getByRole('button', { name: 'Move character' }));
  });
  view.rerender(
    <Host state={movement({ status: { kind: 'error', message: refused } })} />,
  );
  expect(picker.getByRole('alert')).toHaveTextContent(refused);
  expect(picker.getByRole('radio', { name: 'Kingmaker' })).toBeChecked();
  // A corrected destination may start again.
  fireEvent.click(picker.getByRole('radio', { name: 'Thornkeep' }));
  fireEvent.click(picker.getByRole('button', { name: 'Move character' }));
  expect(handlers.startMove).toHaveBeenLastCalledWith(thornkeep);
  view.unmount();

  const uncertain =
    'The move may have been saved. Check its progress before trying again.';
  render(
    <Host
      state={movement({
        needsInspection: true,
        canStart: false,
        canLeave: false,
        canResume: true,
        status: { kind: 'error', message: uncertain },
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(uncertain);
  expect(screen.queryByText(/failed/i)).toBeNull();
  expect(screen.queryByRole('button', { name: /campaign/ })).toBeNull();
  fireEvent.click(button('Check progress'));
  expect(handlers.resumeMove).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).toHaveBeenCalledTimes(2);
});

test('a failed read offers Try again and nothing else; a newer refusal is never hidden by an earlier success', () => {
  const view = render(
    <Host
      state={movement({
        isAvailable: false,
        readError:
          'Campaign choices or move progress could not be loaded. Try again.',
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Campaign choices or move progress could not be loaded.',
  );
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(button('Try again'));
  expect(handlers.retryRead).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).not.toHaveBeenCalled();

  view.rerender(
    <Host
      state={movement({ progress: progress('ready', 6), canStart: false })}
    />,
  );
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(announced()).toMatch(/^Character moved\./);
  const refused = "Move wasn't saved: Campaign not found. Try again.";
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'error', message: refused },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(refused);
  expect(announced()).toBe('');
});

test('Complete move names only the lost assignments and explains copied homebrew for a private departure', () => {
  render(
    <Host
      isMilitiaOnly
      state={movement({
        departureRoles: ['Officer: marshal', 'Team manager: Scouts'],
        progress: progress('ready', 6),
        canStart: false,
        canResume: true,
      })}
    />,
  );
  const panel = within(screen.getByRole('region', { name: 'Move progress' }));
  expect(panel.getByRole('button', { name: 'Complete move' })).toBeEnabled();
  expect(
    panel.getByText(
      'Officer: marshal assignment removed. Finished weeks keep it as it was. Team manager: Scouts assignment removed. Finished weeks keep it as it was. Campaign homebrew is kept as its own copy; the sheet doesn’t change. As a Militia-only character it becomes a Full character, which can’t be undone. Only you can see it afterwards, until you add it to a campaign.',
    ),
  ).toBeVisible();
  expect(panel.queryByText(/militia roster/)).not.toBeInTheDocument();
});

test('Complete move preserves homebrew without claiming lost assignments when departure roles are empty', () => {
  render(
    <Host
      state={movement({
        departureRoles: [],
        progress: progress('ready', 6),
        canStart: false,
        canResume: true,
      })}
    />,
  );
  const panel = within(screen.getByRole('region', { name: 'Move progress' }));
  expect(panel.getByRole('button', { name: 'Complete move' })).toBeEnabled();
  expect(
    panel.getByText(
      'Campaign homebrew is kept as its own copy; the sheet doesn’t change. Only you can see it afterwards, until you add it to a campaign.',
    ),
  ).toBeVisible();
  expect(
    panel.queryByText(/assignment|militia roster/),
  ).not.toBeInTheDocument();
  expect(panel.queryByText(/Full character/)).not.toBeInTheDocument();
});

test('leaving confirms lost assignments, copied homebrew and private access before any save', async () => {
  render(
    <Host
      state={movement({
        departureRoles: [
          'Militia roster',
          'Officer: marshal',
          'Team manager: Scouts',
        ],
      })}
    />,
  );
  fireEvent.click(button('Leave campaign'));
  expect(handlers.startMove).not.toHaveBeenCalled();
  const dialog = within(
    screen.getByRole('dialog', { name: 'Take Vessa out of Rusted Hill?' }),
  );
  expect(dialog.getByText(/Officer: marshal/)).toBeVisible();
  expect(dialog.getByText(/Team manager: Scouts/)).toBeVisible();
  expect(dialog.getByText(/homebrew.*own copy/)).toBeVisible();
  expect(dialog.getByText(/Only you can see it afterwards/)).toBeVisible();
  await act(async () =>
    fireEvent.click(dialog.getByRole('button', { name: 'Leave campaign' })),
  );
  expect(handlers.startMove).toHaveBeenCalledWith();
});

test('arrival to a campaign without a militia does not suggest adding a roster place', () => {
  const view = render(
    <Host
      state={movement({
        progress: progress('ready', 6),
        currentCampaignId: undefined,
        canStart: false,
      })}
    />,
  );
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        currentCampaignId: kingmaker,
        currentCampaignHasMilitia: false,
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(announced()).toBe('Added to campaign.');
  expect(
    screen.queryByText(/Add this character to the militia roster separately/),
  ).toBeNull();
});

const ownerChangedText =
  'This character’s owner changed while the move was being prepared, so nothing moved. Start the move again if you still want it.';
const campaignChangedText =
  'This character’s campaign changed while the move was being prepared, so nothing moved.';
const plainCancelText =
  'Move cancelled. Your character stays in its current campaign.';

test.each([
  ['ownershipChanged', ownerChangedText],
  ['campaignChanged', campaignChangedText],
  [undefined, plainCancelText],
] as const)(
  'a watched move stopped with reason %s says why once; a sheet opened afterwards says nothing',
  (cancelReason, text) => {
    const stopped = progress('cancelled', 2, { cancelReason });
    const view = render(
      <Host
        state={movement({ progress: progress('preparing'), ...pending })}
      />,
    );
    view.rerender(
      <Host
        state={movement({ progress: stopped, status: { kind: 'saved' } })}
      />,
    );
    expect(announced()).toBe(text);
    expect(screen.getAllByText(text)).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Move progress' })).toBeNull();
    expect(button('Move to campaign')).toBeEnabled();
    view.unmount();

    // Opened after it stopped, or by the new owner: nothing to report.
    render(<Host state={movement({ progress: stopped })} />);
    expect(announced()).toBe('');
    expect(screen.queryByText(text)).toBeNull();
  },
);

test('a move replaced from another device says so here while the newer move shows its progress', () => {
  const replacedText =
    'Another move for this character replaced this one. Your character stays in its current campaign until that move completes.';
  const newer = progress('preparing', 1, { operationId: 'op-2' });
  const view = render(
    <Host state={movement({ progress: progress('preparing'), ...pending })} />,
  );
  view.rerender(
    <Host
      state={movement({
        progress: newer,
        replacedMove: progress('cancelled', 2, { cancelReason: 'replaced' }),
        ...pending,
      })}
    />,
  );
  expect(announced()).toContain(replacedText);
  expect(screen.getAllByText(replacedText)).toHaveLength(1);
  expect(
    within(screen.getByRole('region', { name: 'Move progress' })).getByText(
      'Preserving homebrew…',
    ),
  ).toBeVisible();
  view.unmount();

  // Another device, which only ever saw the newer move: nothing to report.
  render(<Host state={movement({ progress: newer, ...pending })} />);
  expect(screen.queryByText(replacedText)).toBeNull();
});

test('a move waiting for destination access reads as unfinished and can be cancelled; the usual progress view returns with access', () => {
  const waiting = progress('waiting', 2, {
    waitingReason: 'destinationUnavailable',
    destinationCampaignId: kingmaker,
    destinationCampaignName: 'Kingmaker',
  });
  const view = render(
    <Host state={movement({ progress: progress('preparing'), ...pending })} />,
  );
  view.rerender(<Host state={movement({ progress: waiting, ...pending })} />);
  const panel = within(screen.getByRole('region', { name: 'Move progress' }));
  expect(panel.getByRole('status')).toHaveTextContent(
    'Waiting for access to Kingmaker…',
  );
  expect(
    panel.getByText(
      'The move continues when access returns. Your character stays in its current campaign.',
    ),
  ).toBeVisible();
  expect(
    panel.getAllByRole('button').map((row) => row.textContent?.trim()),
  ).toEqual(['Cancel move']);
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(announced()).not.toMatch(/cancelled|nothing moved|moved/);
  // It is still this Character's move, so no other move starts meanwhile.
  expect(screen.queryByRole('button', { name: 'Move to campaign' })).toBeNull();
  fireEvent.click(panel.getByRole('button', { name: 'Cancel move' }));
  expect(handlers.cancelMove).toHaveBeenCalledTimes(1);

  // Access returns: the usual progress view, then its result.
  view.rerender(
    <Host state={movement({ progress: progress('ready', 6), ...pending })} />,
  );
  expect(screen.getByText('Ready to move')).toBeVisible();
  expect(screen.queryByText(/Waiting for access/)).toBeNull();
  expect(button('Complete move')).toBeEnabled();
  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(announced()).toMatch(/^Character moved\./);
  view.unmount();

  // Waiting is the move's current condition, so a sheet opened now sees it.
  render(<Host state={movement({ progress: waiting, ...pending })} />);
  expect(
    within(screen.getByRole('region', { name: 'Move progress' })).getByRole(
      'status',
    ),
  ).toHaveTextContent('Waiting for access to Kingmaker…');
  expect(announced()).not.toMatch(/cancelled/);
});

test('edits that change what the move carries restart its preparation with a quiet note, which goes when the move completes', () => {
  const panel = () =>
    within(screen.getByRole('region', { name: 'Move progress' }));
  const view = render(
    <Host
      state={movement({ progress: progress('preparing', 4), ...pending })}
    />,
  );
  expect(panel().getByRole('status')).toBeEmptyDOMElement();
  expect(screen.queryByText(/Recent changes/)).toBeNull();

  view.rerender(
    <Host
      state={movement({
        progress: progress('preparing', 1, { generation: 1 }),
        ...pending,
      })}
    />,
  );
  expect(panel().getByRole('status')).toHaveTextContent(
    'Recent changes to this character are included. Preparing again.',
  );
  expect(screen.getAllByText(/Recent changes/)).toHaveLength(1);
  expect(panel().getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '1',
  );
  expect(panel().getByRole('button', { name: 'Continue move' })).toBeEnabled();

  view.rerender(
    <Host
      state={movement({
        progress: progress('ready', 6, { generation: 1 }),
        ...pending,
      })}
    />,
  );
  expect(panel().getByRole('status')).toHaveTextContent(
    'Recent changes to this character are included.',
  );
  expect(panel().getByRole('status')).not.toHaveTextContent('Preparing again');

  view.rerender(
    <Host
      state={movement({
        progress: progress('completed', 6, { generation: 1 }),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(screen.queryByText(/Recent changes/)).toBeNull();
  expect(announced()).toMatch(/^Character moved\./);
  view.unmount();

  // Opened part-way through a restart, or on a newer move: nothing to note.
  const later = render(
    <Host
      state={movement({
        progress: progress('preparing', 1, { generation: 2 }),
        ...pending,
      })}
    />,
  );
  expect(panel().getByRole('status')).toBeEmptyDOMElement();
  later.rerender(
    <Host
      state={movement({
        progress: progress('preparing', 0, { operationId: 'op-2' }),
        ...pending,
      })}
    />,
  );
  expect(panel().getByRole('status')).toBeEmptyDOMElement();
});

test('a character returned when its owner left the organization says so once, until dismissed, and never reports the move it replaced as a failure', () => {
  const returnedText =
    'Returned to you when you left the organization. Campaign homebrew it used is now part of this character.';
  const replacedText =
    'Another move for this character replaced this one. Your character stays in its current campaign until that move completes.';
  const returned = progress('completed', 6, {
    operationId: 'return-1',
    origin: 'organizationDeparture',
  });
  // Opened after the return, as the owner's private Character.
  const view = render(
    <Host
      state={movement({
        currentCampaignId: undefined,
        canLeave: false,
        progress: returned,
        status: { kind: 'saved' },
        // The owner's own move the return replaced, if this device saw it.
        replacedMove: progress('cancelled', 2, { cancelReason: 'replaced' }),
      })}
    />,
  );
  expect(announced()).toContain(returnedText);
  expect(screen.getAllByText(returnedText)).toHaveLength(1);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(replacedText)).toBeNull();
  expect(announced()).not.toMatch(/moved|left campaign|cancelled/i);
  expect(button('Add to campaign')).toBeEnabled();

  fireEvent.click(button('Dismiss return update'));
  expect(screen.queryByText(returnedText)).toBeNull();
  view.rerender(
    <Host
      state={movement({
        currentCampaignId: undefined,
        canLeave: false,
        progress: returned,
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(screen.queryByText(returnedText)).toBeNull();
  view.unmount();

  // A completed move the owner asked for says nothing here.
  render(
    <Host
      state={movement({
        currentCampaignId: undefined,
        canLeave: false,
        progress: progress('completed', 6, { operationId: 'own-1' }),
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(screen.queryByText(returnedText)).toBeNull();
  expect(announced().trim()).toBe('');
});

// #711: the group the move carries, as the server previews it.
const groupPreview: NonNullable<Movement['groupPreview']> = {
  moving: [
    { characterId: 'vessa' as Id<'character'>, name: 'Vessa' },
    { characterId: 'bryn' as Id<'character'>, name: 'Bryn' },
    { characterId: 'owl' as Id<'character'>, name: 'Whisper' },
  ],
  staying: [
    { characterId: 'cat' as Id<'character'>, name: 'Pip', reason: 'inactive' },
    { reason: 'differentOwner' },
    { reason: 'associated' },
    { reason: 'unavailable' },
  ],
  maxGroupSize: 16,
};
const groupCorrectionText =
  'The 2 Companions moving with it are removed from the militia roster and officer and manager assignments too; saved Activity choices that used them need review.';
const listed = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((row) => row.textContent);

test('the picker names who moves together and why others stay, with one action for all; an unavailable Character has no name, link or label; a lone Character has no group to explain', () => {
  const view = render(<Host state={movement({ groupPreview })} />);
  expect(button('Leave campaign')).toHaveAccessibleDescription(
    `${leaveText} ${groupCorrectionText}`,
  );
  fireEvent.click(button('Move to campaign'));
  const dialog = screen.getByRole('dialog', { name: 'Move to campaign' });
  expect(dialog).toHaveAccessibleDescription(
    `Vessa and its 2 Companions leave Rusted Hill when the move completes. ${leaveText} ${groupCorrectionText}`,
  );
  const picker = within(dialog);
  expect(listed(picker.getByRole('list', { name: 'Moving together' }))).toEqual(
    ['Vessa', 'Bryn', 'Whisper'],
  );
  expect(
    picker.getByText(
      'Up to 16 Characters move together. To move fewer, interrupt a Companion Relationship first.',
    ),
  ).toBeVisible();
  const staying = within(picker.getByRole('list', { name: 'Staying' }));
  const rows = staying.getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual([
    'PipIts Companion Relationship isn’t active, so it stays.',
    'Character unavailableAnother player owns it, so it stays.',
    'Character unavailableMoving a Companion never moves its associated Character.',
    'Character unavailableIt can’t move because it’s unavailable.',
  ]);
  for (const row of rows) {
    expect(row).not.toHaveAttribute('aria-label');
    expect(row.querySelector('[title], [aria-label], a')).toBeNull();
  }
  expect(picker.queryAllByRole('link')).toHaveLength(0);
  // No per-Companion choice: the destination is the only one.
  expect(picker.queryAllByRole('checkbox')).toHaveLength(0);
  expect(picker.getAllByRole('radio')).toHaveLength(2);
  fireEvent.click(picker.getByRole('radio', { name: 'Kingmaker' }));
  fireEvent.click(picker.getByRole('button', { name: 'Move character' }));
  expect(handlers.startMove).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).toHaveBeenCalledWith(kingmaker);
  view.unmount();

  const joining = render(
    <Host
      state={movement({
        currentCampaignId: undefined,
        canLeave: false,
        groupPreview: { ...groupPreview, staying: [] },
      })}
    />,
  );
  fireEvent.click(button('Add to campaign'));
  expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
    'Everyone in the campaign you choose can see and edit Vessa and its 2 Companions. None of them is added to a militia roster.',
  );
  expect(screen.getByRole('list', { name: 'Moving together' })).toBeVisible();
  expect(screen.queryByRole('list', { name: 'Staying' })).toBeNull();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  joining.unmount();

  render(
    <Host
      state={movement({
        groupPreview: {
          moving: [firstMovingMember()],
          staying: [],
          maxGroupSize: 16,
        },
      })}
    />,
  );
  expect(button('Leave campaign')).toHaveAccessibleDescription(leaveText);
  fireEvent.click(button('Move to campaign'));
  expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
    `Vessa leaves Rusted Hill when the move completes. ${leaveText}`,
  );
  expect(screen.queryByRole('list', { name: 'Moving together' })).toBeNull();
  expect(screen.queryByText(/Companion/)).toBeNull();
});

test('leaving with Companions names the group, keeps the listed roles as the requested Character’s own and says every member is corrected', async () => {
  render(
    <Host
      state={movement({ groupPreview, departureRoles: ['Officer: marshal'] })}
    />,
  );
  fireEvent.click(button('Leave campaign'));
  const dialog = within(
    screen.getByRole('dialog', {
      name: 'Take Vessa and its 2 Companions out of Rusted Hill?',
    }),
  );
  expect(listed(dialog.getByRole('list', { name: 'Moving together' }))).toEqual(
    ['Vessa', 'Bryn', 'Whisper'],
  );
  expect(listed(dialog.getByRole('list', { name: 'Staying' }))).toHaveLength(4);
  expect(
    dialog.getByText(
      'Vessa’s Officer: marshal assignment removed. Finished weeks keep it as it was.',
    ),
  ).toBeVisible();
  expect(dialog.getByText(groupCorrectionText)).toBeVisible();
  expect(
    dialog.getByText(
      'Only you can see them afterwards, until you add them to a campaign.',
    ),
  ).toBeVisible();
  expect(dialog.queryByText(/Bryn’s|Whisper’s/)).toBeNull();
  expect(handlers.startMove).not.toHaveBeenCalled();
  await act(async () =>
    fireEvent.click(dialog.getByRole('button', { name: 'Leave campaign' })),
  );
  expect(handlers.startMove).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).toHaveBeenCalledWith();
});

test('a group moves as one: preparation is summed, no member is said to have arrived early, waiting and restarts speak of all of them, and the result counts every member', () => {
  const group = { groupSize: 3, completedMembers: 0, total: 18 } as const;
  const panel = () =>
    within(screen.getByRole('region', { name: 'Move progress' }));
  const view = render(
    <Host
      state={movement({
        groupPreview,
        progress: progress('preparing', 5, group),
        ...pending,
      })}
    />,
  );
  expect(
    panel().getByText('Preserving homebrew for 3 Characters…'),
  ).toBeVisible();
  expect(
    panel().getByText(
      'All 3 Characters stay in their current campaigns until the move completes together.',
    ),
  ).toBeVisible();
  const bar = panel().getByRole('progressbar', { name: 'Homebrew preserved' });
  expect(bar).toHaveAttribute('aria-valuenow', '5');
  expect(bar).toHaveAttribute('aria-valuemax', '18');
  expect(announced()).not.toMatch(/arrived|moved|of 3/);
  expect(screen.queryByText(/0 of 3|1 of 3|2 of 3/)).toBeNull();

  view.rerender(
    <Host
      state={movement({
        groupPreview,
        progress: progress('preparing', 1, { ...group, generation: 1 }),
        ...pending,
      })}
    />,
  );
  expect(panel().getByRole('status')).toHaveTextContent(
    'Recent changes to these Characters are included. Preparing again.',
  );

  view.rerender(
    <Host
      state={movement({
        groupPreview,
        progress: progress('waiting', 18, {
          ...group,
          generation: 1,
          waitingReason: 'destinationUnavailable',
          destinationCampaignId: kingmaker,
          destinationCampaignName: 'Kingmaker',
        }),
        ...pending,
      })}
    />,
  );
  expect(panel().getByRole('status')).toHaveTextContent(
    'Waiting for access to Kingmaker…',
  );
  expect(
    panel().getByText(
      'The move continues when access returns. All 3 Characters stay in their current campaigns.',
    ),
  ).toBeVisible();

  view.rerender(
    <Host
      state={movement({
        groupPreview,
        progress: progress('ready', 18, {
          ...group,
          generation: 1,
          destinationCampaignId: kingmaker,
          destinationCampaignName: 'Kingmaker',
        }),
        ...pending,
      })}
    />,
  );
  expect(
    panel().getByText(
      'Nothing changes until you complete the move; all 3 Characters move together.',
    ),
  ).toBeVisible();
  expect(announced()).not.toMatch(/moved/);

  view.rerender(
    <Host
      state={movement({
        groupPreview,
        progress: progress('completed', 18, {
          ...group,
          completedMembers: 3,
          generation: 1,
          destinationCampaignId: kingmaker,
          destinationCampaignName: 'Kingmaker',
        }),
        status: { kind: 'saved' },
        currentCampaignId: kingmaker,
      })}
    />,
  );
  expect(announced()).toBe(
    '3 Characters moved together. Add them to the militia roster separately.',
  );
  expect(button('Leave campaign')).toHaveAccessibleDescription(
    `${leaveText} ${groupCorrectionText}`,
  );
  view.unmount();

  // Leaving with the group: the requested Character's roles, then the rest.
  const leaving = render(
    <Host
      isMilitiaOnly
      state={movement({
        groupPreview,
        departureRoles: ['Officer: marshal'],
        progress: progress('ready', 18, group),
        ...pending,
      })}
    />,
  );
  expect(
    panel().getByText(
      `Officer: marshal assignment removed. Finished weeks keep it as it was. Campaign homebrew is kept as its own copy; the sheet doesn’t change. As a Militia-only character it becomes a Full character, which can’t be undone. ${groupCorrectionText} Only you can see them afterwards, until you add them to a campaign.`,
    ),
  ).toBeVisible();
  leaving.rerender(
    <Host
      isMilitiaOnly
      state={movement({
        groupPreview,
        progress: progress('completed', 18, { ...group, completedMembers: 3 }),
        status: { kind: 'saved' },
        currentCampaignId: undefined,
        canLeave: false,
      })}
    />,
  );
  expect(announced()).toBe('3 Characters left campaign.');
});

test('a group stopped because its members changed says so once and frees the controls, and a sheet opened afterwards says nothing', () => {
  const groupChangedText =
    'The Characters moving together changed while the move was being prepared, so nothing moved. Review the Companions and start again.';
  const stopped = progress('cancelled', 2, {
    cancelReason: 'groupChanged',
    groupSize: 3,
    completedMembers: 0,
  });
  const view = render(
    <Host
      state={movement({
        groupPreview,
        progress: progress('preparing', 2, { groupSize: 3 }),
        ...pending,
      })}
    />,
  );
  view.rerender(
    <Host
      state={movement({
        groupPreview,
        progress: stopped,
        status: { kind: 'saved' },
      })}
    />,
  );
  expect(announced()).toBe(groupChangedText);
  expect(screen.getAllByText(groupChangedText)).toHaveLength(1);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Move progress' })).toBeNull();
  expect(button('Move to campaign')).toBeEnabled();
  // A fresh review: the picker shows the group as it is now.
  fireEvent.click(button('Move to campaign'));
  expect(screen.getByRole('list', { name: 'Moving together' })).toBeVisible();
  view.unmount();

  render(<Host state={movement({ groupPreview, progress: stopped })} />);
  expect(announced()).toBe('');
  expect(screen.queryByText(groupChangedText)).toBeNull();
});

test('an oversized group shows its size, cap and remedy before a move, in the picker and in the leave dialog', () => {
  const capRefusal = {
    reason: 'groupTooLarge' as const,
    groupSize: 17,
    maxGroupSize: 16,
  };
  const message =
    'These 17 Characters can’t move together. Up to 16 Characters move together. To move fewer, interrupt a Companion Relationship first.';
  render(
    <Host
      state={movement({
        canStart: false,
        canLeave: false,
        canReviewMove: true,
        groupPreview: { ...groupPreview, refusal: capRefusal },
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByText(/could not be loaded/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

  fireEvent.click(button('Move to campaign'));
  const picker = within(
    screen.getByRole('dialog', { name: 'Move to campaign' }),
  );
  expect(picker.getByRole('alert')).toHaveTextContent(message);
  expect(picker.getByRole('button', { name: 'Move character' })).toBeDisabled();
  expect(
    picker
      .getAllByRole('radio')
      .every((radio) => radio.hasAttribute('disabled')),
  ).toBe(true);
  fireEvent.click(picker.getByRole('button', { name: 'Move character' }));
  expect(handlers.startMove).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  fireEvent.click(button('Leave campaign'));
  const leave = within(screen.getByRole('dialog'));
  expect(leave.getByRole('alert')).toHaveTextContent(message);
  expect(leave.getByRole('button', { name: 'Leave campaign' })).toBeDisabled();
  expect(
    leave.getByRole('button', { name: 'Stay in Rusted Hill' }),
  ).toBeEnabled();
  fireEvent.click(leave.getByRole('button', { name: 'Leave campaign' }));
  expect(handlers.startMove).not.toHaveBeenCalled();
});

function firstMovingMember() {
  const member = groupPreview.moving[0];
  if (!member) throw new Error('Missing requested Character in move preview');
  return member;
}
