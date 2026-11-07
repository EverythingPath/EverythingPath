// The single source of truth for Catalog calculation identities. This module names the hash of
// catalogCalculationV1Files, so it must stay outside that closure. When a calculation file changes
// before first activation, run `pnpm catalog:pin`, then in one change:
// 1. set currentCalculationIdentity (and the independent literal in
//    tests/catalogRuntimeCompatibility.test.ts) to the printed identity;
// 2. move the old current identity to retainedPriorCalculationIdentity;
// 3. push the old prior identity onto the front of supersededCalculationIdentities.
// See docs/catalog-import/releases.md.
export const currentCalculationIdentity =
  'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9';

// #318 retains the previous identity: the dispatcher accepts it alongside the current one.
export const retainedPriorCalculationIdentity =
  'sha256:bbd312136e9866bd8bcccda933a885d554422b58d9e1839b1f1d78ed4da04a25';

// Earlier identities, newest first. The dispatcher rejects them.
export const supersededCalculationIdentities = [
  'sha256:6b19c1c073d8ecd08136986714bc5305108dfe330c2c5a4adb24baea0ca7c0b7',
  'sha256:9b1adf9809acc8fe66e7db8b4a9a2d3c709dea19f54ff87f005c6f5926fa4a61',
  'sha256:005ef0b9d4d4230972e08d6b0989f7117156cba9eaefd5162406c01af1ffe9ae',
  'sha256:7d778ba479ec09c10fb19bb619ba9db219a1f5fd3dc01020c1f1a81ae5a840b3',
  'sha256:e60d5319950d0093702b0f3350255430da0b84f7316319d3529b6aa74ed82e2b',
  'sha256:b38d788d417b7d465ac377276015bee53ba37ebdef35c2ccd57f69635136b49a',
  'sha256:09c256c236e48841e76b1707e93bd2f4a763f6517a1d470c380c4366c159e6d3',
  'sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063',
  'sha256:52f42dd87903d3f6cdc69f576c93fd2788421cb12540b1969727f6aadcfc333b',
  'sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b',
  'sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518',
  'sha256:b198c9915cd577d19b6a8f5752035da0f1d8a9a39dc89ae92ce5c991764efcbb',
  'sha256:d4c6c3930b626c3fcc78aa86ac2dd7d26dc0bc01fadbd51ce4d0daf3e95ada87',
  'sha256:3f0a55b368c9ce34a574bc0777305535fd8e8e131908adb7c46071001e7a16ec',
  'sha256:3387e763d0d27779ae4bfeb56034bf07ed8a0b5518e81cfecf1e683981bd246a',
  'sha256:a6c14f561ad02e1300ec186d39d1b38abd56211719e1525218e4fea2347d3ba9',
  'sha256:8a004d423c0d0bee6d81fa36f99ed92ed96d7b41edd4850e41f2f575c8d8c805',
  'sha256:d68e60a01b727e3ba64e04df77a5e9becffa76755f52d1d0ed944222b64e2819',
  'sha256:52d602490642463289612f134ffa417a949e7158248199b6d61010f9180e09fd',
  'sha256:2e3783ba347b2552993abc97e63ae35d5a918d17f598f2dc4e805c7f7367a324',
  'sha256:25ee509d25367de4d4aa250aaea4e9604e8b8aa3f8316dd130d937f5c1ed4e0f',
  'sha256:dc316444d9aac3f85896707c6d6495c841be9290f34beba49a5c6309d8a22875',
  'sha256:71986cc2905ba5996ac86d1849f934211fcfb6d52fc3ca9ed1c838e88a76c559',
  'sha256:f914e5ff5366e85cc1e3d1823a97178d0e4c0f0f3f38d6b860554a6b1ce6a17a',
  'sha256:bf70c084f769480abb0441cf1aaad530a0707af15e242adf1fd9dc1f0d9e8f70',
  'sha256:0374c27ce3f9c213cad56c14b60015402473f49ef383e4be8522bac455c21a2c',
  'sha256:a5c210fb25c87efb75f5bd1cc8be079e9f888cc511eb17a5dcd62f65f396f03a',
  'sha256:2a52754f3edb0a81bb659bbba2bd3bd5d2931961d87a99fa84dc8ce2a760ad35',
  'sha256:64f6b226f22191b2f7a9ad11336e78b4bf8dcbff2598229cc616d5e6adb963c3',
  'sha256:d8b1bdc4b4831a09b963451f773942e0f67e81ac73311d3a02441e78f8e03b4e',
  'sha256:83889cf16ed8029974c3931086ac0ead4e2104adda7e3b6d58582b4fb024c65f',
  'sha256:ae6c9964f20f8eec62f81a5dc06ecf3dcea5ad0a91acdbdb50d0cd043aa37c19',
  'sha256:45f206c9e82ffbe2192481b0d7364bc0313b686be084ec93ae537a4b62409a27',
  'sha256:4f2501f66eae519f7aad1c967ad5c8e47bde6c36ffecb26daceb8529def924cd',
  'sha256:8886e8d9739739831604b4fda6f11ea3c3b7c4a38d6a0cfc5c1492448ed93b92',
  'sha256:becf4290fdf699293d79c24d577e75dddde57919ad7291d8ea7b0eaebdc73cfc',
  'sha256:c34f3f686fc800ec766394a7a8fb747d317da5de31e4d00def22c25c6542e5c6',
  'sha256:cbdc087920f8f8027046422551e15dbb0151488bffd07ddc9375bead9021e539',
  'sha256:a0a094c701ddeb6123a372b6106ae32d22969bdf4a256c1bfaf2320c34d48bf0',
  'sha256:404dc533a4f5212248f8c8aa720de4115d85196b171e802d6d2cceff56aa9982',
  'sha256:10de1531a3f695d0eb5a42a632047548ca7f1afd4c8b59e48d9804ec940dbc07',
  'sha256:7a6006e58cfc1d2ed3c438033e53b82ef1d70cc9569449ecb6d6f00d8cc3f366',
  'sha256:65b39be01f2e0a0ab0abc5cf9c626b4344ed2e40f60fb1b4418ae7b9d509e6fd',
] as const;
