# Weekly Draft rules coverage

95 audit entries; 487 expanded cases; 487 cases with passing mapped evidence; 0 explicit gaps; 0 errors.

Passing evidence is traceability, not proof of semantic completeness. Full-corpus human review and the strict gate remain required before cutover.

## Errors

None.

## Human corpus review

Reviewed by AndreasUnunger (2026-09-23); docs/militia-human-review-checklist.md#finish-the-review — every check and full sign-off marked complete; reviewer confirmed “done” in the review conversation.

Review every source section against its mapped behavior and tests, including all actions, event outcomes, team trees, officers/managers, sequence, and product/persistence decisions. Classify introductory text explicitly; a fingerprint alone does not establish semantic review. Record reviewer, date, reference, and unresolved findings before clearing review gaps.

| Source section | SHA-256 | Mapped rules / review gap |
|---|---|---|
| [R001: # Ironfang Invasion Militia Rules](../docs/ai/ironfang-militia/militia-rules.md) | defbc5620a0476f78c955c60f93f65da945653921b2110057777b350aa4bced2 | F01 |
| [R005: ## Scope](../docs/ai/ironfang-militia/militia-rules.md) | 1f2449d3ebfcbddabdab4cc61002722fd1475a83bd8082aecd5979aaa46b11ca | F02 |
| [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md) | 31adf414cd1043e7f78c49a8ee3f1b839b5c4c5c17ae5be9d758a6d7246b990b | F01, F02, F03, F04, F05, F06, F07, O06, U01, E01, E05, E06, P01 |
| [R021: ### Rank](../docs/ai/ironfang-militia/militia-rules.md) | 787be90a17cee5550617389f0b4bfdc00393c6690adcc02303b6352ce849c6e0 | F01, F02 |
| [R028: ### Maximum Rank](../docs/ai/ironfang-militia/militia-rules.md) | e591095e8edf92f7dcfb542980fb86546a5fd132b9136dc23e733e92e9d7b736 | F02 |
| [R032: ### Organization Checks](../docs/ai/ironfang-militia/militia-rules.md) | c64aaed64747ee5b93ba6d62a44fd2ece5e9dd45bb7cee3b58b0e7429f9a1883 | F03 |
| [R039: ### Focus](../docs/ai/ironfang-militia/militia-rules.md) | 17a3ae7112f0b0e9e15a05e76a4b781066d62effadf4143f4023df55195091be | F01, F03 |
| [R044: ### Training](../docs/ai/ironfang-militia/militia-rules.md) | fd5a8c4e60c6c33c0395c2df0e366b415d84721c7a9acd1a65560050740dc582 | F01, F06 |
| [R051: ### Reputation](../docs/ai/ironfang-militia/militia-rules.md) | f47928c34431b7652ea3bf681892cf04b89e2d632bdfc67e5b39e48cf75d95f4 | F07 |
| [R058: ### Treasury](../docs/ai/ironfang-militia/militia-rules.md) | 9405cb8aa785c1ca652dc3daee91b41367c1fccd36d5f0601c9c9b71341c1538 | F01, F06 |
| [R064: ### Minimum Treasury](../docs/ai/ironfang-militia/militia-rules.md) | ec26d8c0a3bab95a04e9e3eb77cb57fb869f90e82604259a7ec49551582c91f9 | F06 |
| [R069: ### Notoriety](../docs/ai/ironfang-militia/militia-rules.md) | e303b498fc0f332298270e71df29e406bb1c8e879a0b7c1a6d2c08cb78607863 | F06 |
| [R076: ### Militia Actions](../docs/ai/ironfang-militia/militia-rules.md) | 7d1bbb1240e848a0ea3b464de987bd920f07e05ddefc7025bb7f4fa7261c9bdd | F04 |
| [R081: ### Event Chance](../docs/ai/ironfang-militia/militia-rules.md) | fcae8d403daff96134a26d18ee7b7ebb13abfea3f09cd43ce604dbd6d31518a8 | E01, E05 |
| [R088: ### Active and Persistent Events](../docs/ai/ironfang-militia/militia-rules.md) | 28a5aee4e0dee6c93d5f8b5bbea72c83d94ea5205ae223c0e1775fc2cc3e46f5 | E06, P01 |
| [R093: ### Officers and Teams Management](../docs/ai/ironfang-militia/militia-rules.md) | b61424ae0fa6c2f67e674da30cfb11d42c235e5c37c7564c2d6f8320b562a422 | O06 |
| [R101: ### Maximum Teams](../docs/ai/ironfang-militia/militia-rules.md) | 9403e4cf0b54048be5ae2d2cb1c8fd2e03d87b4493b732711f86b99a0fddfbeb | F05 |
| [R106: ## PC Boons by Rank](../docs/ai/ironfang-militia/militia-rules.md) | 1e0119677fd189a02a0a57381dc9b2838081f81c7a4e5744b5731472866c041b | F08 |
| [R114: ### Title Feat Packages](../docs/ai/ironfang-militia/militia-rules.md) | d2a6d43cc7198332c944e31c7aeacbe1637e2d3b78cfd85b53d8e8ca72d9417f | F09 |
| [R121: ## Officers](../docs/ai/ironfang-militia/militia-rules.md) | 679d763084de912074f9f545b439db7a58b0929146062dbd8b2f2066e015390b | O01 |
| [R125: ### Ambassador](../docs/ai/ironfang-militia/militia-rules.md) | 18f26c7cbbd5d39356dce2dd3537bf6e6d617cd718cf452c38957ff67067d58d | O02 |
| [R129: ### Commandant](../docs/ai/ironfang-militia/militia-rules.md) | 87feb1730dc25bca93659119c1014b7e8c659e251807e7a486e2239e68e62ca7 | O03 |
| [R133: ### Marshal](../docs/ai/ironfang-militia/militia-rules.md) | d82994af6986ff2d3573edc604c14a2ab81b5674e7a1b4d97f18aa01df800a33 | O02 |
| [R137: ### Overseer](../docs/ai/ironfang-militia/militia-rules.md) | 37dee01675fedded183321303284eacec3f7272ac5fc18dbd637ff077ccd8c49 | O04, E07 |
| [R145: ### Spymaster](../docs/ai/ironfang-militia/militia-rules.md) | 6ac84872425a514560edc37e27e0416b230ca4a0e84e067d37cad4a9bc43deef | O02 |
| [R149: ### Strategist](../docs/ai/ironfang-militia/militia-rules.md) | d072040974fb6c6830e0282b933f7cb74820e445d98855a7ea7f7007e14951e1 | O05, E07 |
| [R154: ## Teams](../docs/ai/ironfang-militia/militia-rules.md) | de230cf9e7386ee07025a1e33edd1a404ced867ad014f0426363b20417f46933 | T05, A14 |
| [R163: ### Team Conditions](../docs/ai/ironfang-militia/militia-rules.md) | 644769ce8572bd3249c95bf9d2e9d473a2bdd1ccbae282b3e8d27ce04eed180d | T07, T08 |
| [R165: #### Disabled](../docs/ai/ironfang-militia/militia-rules.md) | 21e3f1381c8de1406e89b8ba31d334b4467a7b1afccb5d5c393fb28745c08d1c | T07 |
| [R171: #### Missing](../docs/ai/ironfang-militia/militia-rules.md) | bc4a2d765d941c78ee4b91b23a7e72bc030e420c8f3e8a91d63522db9c194856 | F05, T08 |
| [R178: ## Team Trees](../docs/ai/ironfang-militia/militia-rules.md) | 3266877568782f312149f15f9f6c388ab8e6cdfe7f7caa919a73e53938316e02 | T01, T02, T03, T04, T05, T06 |
| [R180: ### Espionage](../docs/ai/ironfang-militia/militia-rules.md) | 9c1cb1df9ba4d14c5a81dc12def8e36f2eacf038fdec59383509f8dfeaf68117 | T01 |
| [R187: ### Intelligence](../docs/ai/ironfang-militia/militia-rules.md) | 254a15d1c888d677a3c7d5b3236640f905391c4aed7a98bbd424dacfe45fc5dd | T02 |
| [R194: ### Military](../docs/ai/ironfang-militia/militia-rules.md) | c5777cd17298f33bdb28514470db0027df7086a02164d3f1e5e63a6cf041982f | T03 |
| [R201: ### Treasury](../docs/ai/ironfang-militia/militia-rules.md) | 2fc309afe73d973cd9dd4bb6e51c6e943014a8587b51eb8da776c902706b8154 | T04 |
| [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md) | 04d74ee385fa326ca668e52d4bb40b90789e0428ea26f0f84652531527e68cbd | U01, U06, P04, P05, P06, P07, P08, P09, P10, P11 |
| [R217: ## Upkeep Phase](../docs/ai/ironfang-militia/militia-rules.md) | d8c83eb6739a2c58a149fcff36b0d8d0b8bd425585c2fe4f9704700cb142f3f8 | U01, U02, U03, U04, U05 |
| [R219: ### Step 1: Training Attrition](../docs/ai/ironfang-militia/militia-rules.md) | a487755905a80cb9aa280e080dedc1c4f571116772811d0138bb88186f10e991 | U02 |
| [R226: ### Step 2: Maximum-Notoriety Penalties](../docs/ai/ironfang-militia/militia-rules.md) | e78483f54b7bf6965c1d73729a34c01df60b8790323933df1aba4f3a59eb94bc | U03 |
| [R232: ### Step 3: Treasury-Shortage Penalties](../docs/ai/ironfang-militia/militia-rules.md) | fc83820e86ec816786b8f417642509187e32cc58b28184ff4026d87b820d5329 | U04 |
| [R237: ### Step 4: Increase Rank](../docs/ai/ironfang-militia/militia-rules.md) | 0875a170c56fb698c1d6a7c42642ef443b995607b38eb306e86e5dbe6f925270 | U04 |
| [R244: ### Step 5: Deposits and Withdrawals](../docs/ai/ironfang-militia/militia-rules.md) | 1d8c164c6627dfe03605c6c02243f4a839a84b8d7f3b3d8cfa8baa313ada7307 | U05 |
| [R248: ## Activity Phase](../docs/ai/ironfang-militia/militia-rules.md) | c8483b4e639fc475482612b80133b761f209776647bc9e8cfd5f2680e04a36bf | U06, T06 |
| [R254: ## Action: Activate Black Market](../docs/ai/ironfang-militia/militia-rules.md) | 4b62ef72ddc9e3a7cd0962038947bc4082b9df7784c6a53b02a2379db1bfc15a | A01 |
| [R262: ## Action: Activate Refuge](../docs/ai/ironfang-militia/militia-rules.md) | e012bc5f5e1251dbff2f898f0a7e8675444596ec7002b81bfda8aaa92ffc1d95 | A02 |
| [R268: ## Action: Broker Market](../docs/ai/ironfang-militia/militia-rules.md) | 74d272b45d0f605b960d9cce8712e6dd314d43a1d3a70f2d0e7e2beb1096aac6 | A03 |
| [R277: ## Action: Change Officer Role](../docs/ai/ironfang-militia/militia-rules.md) | 0bc8637abd007f6bc45b03ced2695a527f939a00cd14b8927e31ce3fa62168cf | A04 |
| [R283: ## Action: Covert Action](../docs/ai/ironfang-militia/militia-rules.md) | b94e04c4ba4d61c54dd270348c7751f95f78b5f4b6f7beea7278b22cff2699fc | A05 |
| [R291: ## Action: Dismiss Team](../docs/ai/ironfang-militia/militia-rules.md) | d62332bf6eff0b2f447bea42dc888c582aef8eb1a9eaa3307f368c47beede40c | A06 |
| [R298: ## Action: Drill Militia](../docs/ai/ironfang-militia/militia-rules.md) | 1cf2dfd5ed5e9e188e360d4305e2ce5ebff7877d3e600ec03102a086da2159f2 | A07 |
| [R308: ## Action: Earn Gold](../docs/ai/ironfang-militia/militia-rules.md) | 7981a667a49ba89cabc774e6ba8c442d26b448bbb1dbf3fdbde8edc1aecd8298 | A08 |
| [R315: ## Action: Gather Information](../docs/ai/ironfang-militia/militia-rules.md) | 1768f9ebdfd71d3b37b88962e5c8612f86f34a7854249f9d750d36ec0040238d | A09 |
| [R322: ## Action: Guarantee Event](../docs/ai/ironfang-militia/militia-rules.md) | 95dbe0ff065c58802d10cd2edae81435c9dc775f8ef7236ea809031bba301acd | A10 |
| [R329: ## Action: Knowledge Check](../docs/ai/ironfang-militia/militia-rules.md) | 0720256c4001407f7249f6ad90c0055dacb38b2db4008fb362649d944848606d | A11 |
| [R336: ## Action: Lie Low](../docs/ai/ironfang-militia/militia-rules.md) | 0546836ea7e0dd8922c0ac9256106e798b8468d69e0aa656ebdcba0f3379db7f | A12 |
| [R342: ## Action: Manipulate Events](../docs/ai/ironfang-militia/militia-rules.md) | fb656c11cc52127c89816922963de959c4acc74022847e6abdb57249810d5bde | A13 |
| [R349: ## Action: Recruit Team](../docs/ai/ironfang-militia/militia-rules.md) | 5c4a6a604647d38db54cab593d50e6159b354c86df31e6db044dbcd1a6db17e9 | A14 |
| [R356: ## Action: Reduce Danger](../docs/ai/ironfang-militia/militia-rules.md) | 16722688e688dbd87c0ab0e90ac6d7ad16a86a3666e337a896a019efda72f1b8 | A15 |
| [R363: ## Action: Rescue Character](../docs/ai/ironfang-militia/militia-rules.md) | ee50283bb897eb075a59288cdd34151854c3d0efaac8199136a1c86a79ff2ce7 | A16 |
| [R372: ## Action: Restore Character](../docs/ai/ironfang-militia/militia-rules.md) | ad3c1ef6c06f5da8faec3431025a34738031e88c4984917c8c5e9ec337816419 | A17 |
| [R386: ## Action: Sabotage](../docs/ai/ironfang-militia/militia-rules.md) | b40a76f3042522fd3182a960137c36da2f63385a6e02a47259e00fdb5b063a9d | A18 |
| [R393: ## Action: Secure Cache](../docs/ai/ironfang-militia/militia-rules.md) | 5ea452eaf2ed27468bac1bc07bc7dbe37f8dfe121003da4b3efd6642a1db9af2 | A19 |
| [R407: ## Action: Special](../docs/ai/ironfang-militia/militia-rules.md) | 3ab797c5de8d7bd3fe1128041288121f0f292dd8372905dcb80eced14ab26457 | A20 |
| [R412: ## Action: Special Order](../docs/ai/ironfang-militia/militia-rules.md) | af39323a5fc3a039307a5c01707b33bf84ed3b4ef549f0571001d2a615a888e5 | A21 |
| [R423: ## Action: Spread Propaganda](../docs/ai/ironfang-militia/militia-rules.md) | 9a01df19bc940aa8e4ce5fd66a21c226f959b5b93281417615fd2a99b6227963 | A22 |
| [R432: ## Action: Strike Team](../docs/ai/ironfang-militia/militia-rules.md) | 55d3902d94de0f32c747798b886f4ee76c83df4fb53223a4e7243c0f465f68cc | A23 |
| [R443: ## Action: Upgrade Team](../docs/ai/ironfang-militia/militia-rules.md) | da61e6b738884ea83dac920972063ac3d9d65a32d2a5f20a550e3ee91ce5ee8c | T05, A24 |
| [R450: ## Event Phase](../docs/ai/ironfang-militia/militia-rules.md) | be258b712e6bf259593c66988757ead15ea2318a78825e3906a1360d54ef0aec | E06 |
| [R452: ### Event Trigger](../docs/ai/ironfang-militia/militia-rules.md) | 3c48ced949ac1159277e5bb4f48fb20ea2ddc32966975d6c1432cf15aea67fc2 | E01, E05 |
| [R460: ### Event Resolution Notes](../docs/ai/ironfang-militia/militia-rules.md) | 9f70d702d84870e4197d5728040c277946295cb96e7d43d0d88fe9c97624c1f4 | E03, P01 |
| [R468: ## Event: All Is Calm](../docs/ai/ironfang-militia/militia-rules.md) | abae6516cea307f12e8d920f036cfe47497b6f502c56a5268fde82fca42b67a9 | E05, EV01 |
| [R473: ## Event: Broke the Code](../docs/ai/ironfang-militia/militia-rules.md) | 9b76a8217f7dfb50dadca680f2d8fb5236e5bdd49ad5077b0a049c388790cb66 | EV02 |
| [R479: ## Event: Cache Discovered](../docs/ai/ironfang-militia/militia-rules.md) | 3b26eae4ae1036f4dd0cfa2e5786286c418195dabf0bf0b8ed206211d8aabd80 | EV03 |
| [R485: ## Event: Calm before the Storm](../docs/ai/ironfang-militia/militia-rules.md) | 7ccdc6becd3795a9233d1fefa8587774583e4c73b166ce82e7ca64d0c3946035 | E05, EV04 |
| [R492: ## Event: Double Agent (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md) | f66639d2a01dd383035d7890cc23e25ad17696b69729c8ab0a230db073167c49 | EV05 |
| [R498: ## Event: Festival](../docs/ai/ironfang-militia/militia-rules.md) | 59e9292d142c8ff2b3bb32e084cfbe5844bd400bb8b3591ce2eef3b832fe2df5 | EV06 |
| [R504: ## Event: Found Fire](../docs/ai/ironfang-militia/militia-rules.md) | c8ff012a55de57158448fff0eb24ceee43d6cf3808b7accea22d69bef5448c91 | EV07 |
| [R510: ## Event: Hidden Agenda](../docs/ai/ironfang-militia/militia-rules.md) | 4d28ed6c93e3a827e2fb454e0e9b1e296f24d4f21f73750d7122cf40aecfd270 | EV08 |
| [R515: ## Event: High Morale](../docs/ai/ironfang-militia/militia-rules.md) | 2b0d91bcc4de8e7cd26736b64c9ed3782205cfce715aa58d4e70426652679c9c | EV09 |
| [R521: ## Event: Invasion](../docs/ai/ironfang-militia/militia-rules.md) | cbd966599940b753f0a3f82a1a459d28bd9d2eda5ec6869dab39cb676ae84dd8 | EV10 |
| [R525: ## Event: Low Morale (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md) | ad99f39df0498e9f603c25386f22b0fcd8f8d0744b16e24c2e57062bef8e6595 | EV11 |
| [R530: ## Event: Market Day](../docs/ai/ironfang-militia/militia-rules.md) | a6e05847596c89283ceeb73ffd37e6aca68d49f0e6a786458b12a2be0bb1002b | EV12 |
| [R535: ## Event: Missing in Action](../docs/ai/ironfang-militia/militia-rules.md) | d2383bb3db66af1a4d03191aa32ffb3d645c1efac5829d907af714884e1da7c9 | EV13 |
| [R540: ## Event: Night Ops](../docs/ai/ironfang-militia/militia-rules.md) | d7329f851eb5edcb3f13b5de92e4c8ec189532d2add6279395ed08317f31119b | EV14 |
| [R545: ## Event: Raid](../docs/ai/ironfang-militia/militia-rules.md) | 8ff2692bfa24ce1830783b9c8fb97db842792275e910a26d25c944d46d7bc9d9 | EV15 |
| [R551: ## Event: Rivalry (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md) | fe91929fa2c6602126d8a21b556363f6b80b4c55dccf96e67f3b8c6cb0ad413c | EV16, P02 |
| [R556: ## Event: Roll Twice](../docs/ai/ironfang-militia/militia-rules.md) | 945bc98b2ac547eaa9bf8cbe8f232e27bb79dd8d5977650ddbb662c318288ce1 | E04, EV17 |
| [R562: ## Event: Sickness](../docs/ai/ironfang-militia/militia-rules.md) | ed42fe01fe4d1831189d6b94fd7bcc658f5ec82596e25fa0121d029e23f01a9b | EV18 |
| [R567: ## Event: Theft (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md) | 3fc1a5439d700c312bf9281b0a9dad0a227248d6208ed2e70313925d4e94aae2 | U06, EV19, P02 |
| [R573: ## Event: Turn Around](../docs/ai/ironfang-militia/militia-rules.md) | 7f25ee783e48300f4069adbdf9f05f66aba89a75098c79b5bdd47c4718217d5b | EV20 |
| [R578: ## Event: Turncoat](../docs/ai/ironfang-militia/militia-rules.md) | 5927fbc390f7fbcc60f71c01729462b71616d709e1d0e15a9f73ad0cca37f1ff | EV21 |
| [R583: ## Event: War Games](../docs/ai/ironfang-militia/militia-rules.md) | 8452c55e4fe1ca70b2952d1c12be3096084bd35d9b891045b5a8f79e9be214c7 | EV22 |
| [R587: ## Event: Week of Pain](../docs/ai/ironfang-militia/militia-rules.md) | 392fd9e79d31f3830f60a2683735ceab689f784b4b598694c05f65c77feeb79b | EV23 |
| [R593: ## Event: Week of Serenity](../docs/ai/ironfang-militia/militia-rules.md) | ffdae062f92091fa34e1a5b85e23c0dc7fcc1f26fff3141c6417809ef314bc35 | EV24 |
| [R599: ## Persistent Events Rules](../docs/ai/ironfang-militia/militia-rules.md) | 6f6c08ea7bc03d6a5a90790de77600f290815774e818c65c2670a87d5b549005 | P01, P02, P03 |
| [R605: ## Caches](../docs/ai/ironfang-militia/militia-rules.md) | 4006139b8e17e1f13ef9194225469f530b20348c77910ac98b66be3bbb8b586d | A19 |
| [R607: ### Minor Cache](../docs/ai/ironfang-militia/militia-rules.md) | 51f87aaf6bc578ec29f8b96fb929770125cd630554ce3ec1d832373ab0fc7fe4 | A19 |
| [R612: ### Intermediate Cache](../docs/ai/ironfang-militia/militia-rules.md) | c6af5443793254ec5767c6020d77c39a8aca0e307e8d16fb13466d2062ab6e9b | A19 |
| [R617: ### Major Cache](../docs/ai/ironfang-militia/militia-rules.md) | 73aa02e7f9f3a29334628ab9b518a3495d8ea516890cf50751f50a6c3263d9d0 | A19 |
| [T001: # Ironfang Militia Structured Tables](../docs/ai/ironfang-militia/militia-tables.md) | 71ee6cedc08fc3c696bcb28b11ba37639b7992b36247721234745cb2c4184699 | T01, T02, T03, T04 |
| [T003: ## Rank and Reward Teams](../docs/ai/ironfang-militia/militia-tables.md) | 9847a7815977e34c8a29b03e9a614aec70d0207444706e2556f676c235b74198 | F02, F05 |
| [T016: ## Table 6-1: Militia Advancement](../docs/ai/ironfang-militia/militia-tables.md) | 52583d0dcf37aab20eba848cff60690b43bf6b1b602fe41521636dff9a7655dd | F01, F02, F03, F04, F05, F08, F09 |
| [T046: ## Table 6-2: Reputation](../docs/ai/ironfang-militia/militia-tables.md) | 6c295036f45c72354d707db37180acf3c413ada6b9ed6a174d554d03f54b0f91 | F07 |
| [T056: ## Table 6-3: Militia Events (d%)](../docs/ai/ironfang-militia/militia-tables.md) | 8d8709bb5c7e3be7814ce1affd9f66fd6cc5e07ed9c80b00cced9e2935846a7e | E01, E02, E05 |
| [T091: ## Cache Thresholds](../docs/ai/ironfang-militia/militia-tables.md) | df23046b62c7d0813a072cc9df12f4b452d7c2074809b0149e19670927dd66c3 | A19 |
| [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md) | 5d1dd6a021a4d7049b11f8ab3913136e932cc83d7c808f369dd2481962b88540 | F01, F02, F03, F04, F05, F06, F07, F08, F09, O01, O02, O03, O04, O05, O06, U01, U02, U03, U04, U05, U06, T01, T02, T03, T04, T05, T06, T07, T08, A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A24, E01, E02, E03, E04, E05, E06, E07, EV01, EV02, EV03, EV04, EV05, EV06, EV07, EV08, EV09, EV10, EV11, EV12, EV13, EV14, EV15, EV16, EV17, EV18, EV19, EV20, EV21, EV22, EV23, EV24, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11, GATE |
| [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md) | b1a8f470687787a5266b7b7b3b29fe0c6f26fc2228edea1de55d7ef7b58dcf22 | F01, F02, F03, F04, F05, F06, F07, F08, F09, O01, O02, O03, O04, O05, O06, U01, U02, U03, U04, U05, U06, T01, T02, T03, T04, T05, T06, T07, T08, A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A24, E01, E02, E03, E04, E05, E06, E07, EV01, EV02, EV03, EV04, EV05, EV06, EV07, EV08, EV09, EV10, EV11, EV12, EV13, EV14, EV15, EV16, EV17, EV18, EV19, EV20, EV21, EV22, EV23, EV24, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11, GATE |
| [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md) | a62c543032e1d37c127dee12ee8cb6e8067a453159f7ff29a984d5b80b7cf59b | F01, F02, F03, F04, F05, F06, F07, F08, F09, O01, O02, O03, O04, O05, O06, U01, U02, U03, U04, U05, U06, T01, T02, T03, T04, T05, T06, T07, T08, A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A24, E01, E02, E03, E04, E05, E06, E07, EV01, EV02, EV03, EV04, EV05, EV06, EV07, EV08, EV09, EV10, EV11, EV12, EV13, EV14, EV15, EV16, EV17, EV18, EV19, EV20, EV21, EV22, EV23, EV24, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11 |
| [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md) | 99a1d9773ef53743820f78f6f1d739169b6a7d329bca6252075db213fc09dcb5 | F01, F02, F03, F04, F05, F06, F07, F08, F09, O01, O02, O03, O04, O05, O06, U01, U02, U03, U04, U05, U06, T01, T02, T03, T04, T05, T06, T07, T08, A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A24, E01, E02, E03, E04, E05, E06, E07, EV01, EV02, EV03, EV04, EV05, EV06, EV07, EV08, EV09, EV10, EV11, EV12, EV13, EV14, EV15, EV16, EV17, EV18, EV19, EV20, EV21, EV22, EV23, EV24, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11, GATE |
| [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json) | f73f872f8a7e40eb05cce18ff842873c9989700e04bf9795d5944a07d361ff0a | F01, F02, F03, F04, F05, F06, F07, F08, F09, O01, O02, O03, O04, O05, O06, U01, U02, U03, U04, U05, U06, T01, T02, T03, T04, T05, T06, T07, T08, A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A24, E01, E02, E03, E04, E05, E06, E07, EV01, EV02, EV03, EV04, EV05, EV06, EV07, EV08, EV09, EV10, EV11, EV12, EV13, EV14, EV15, EV16, EV17, EV18, EV19, EV20, EV21, EV22, EV23, EV24, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11 |
| [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json) | 823886d8311e6a622a09ee2a7f89efc6efa5a05826509da55a4048dc47115eb6 | F01, F02, F03, F04, F05, F06, F07, F08, F09, O01, O02, O03, O04, O05, O06, U01, U02, U03, U04, U05, U06, T01, T02, T03, T04, T05, T06, T07, T08, A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22, A23, A24, E01, E02, E03, E04, E05, E06, E07, EV01, EV02, EV03, EV04, EV05, EV06, EV07, EV08, EV09, EV10, EV11, EV12, EV13, EV14, EV15, EV16, EV17, EV18, EV19, EV20, EV21, EV22, EV23, EV24, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11, GATE |

## F01

Sources: [R001: # Ironfang Invasion Militia Rules](../docs/ai/ironfang-militia/militia-rules.md); [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R021: ### Rank](../docs/ai/ironfang-militia/militia-rules.md); [R039: ### Focus](../docs/ai/ironfang-militia/militia-rules.md); [R044: ### Training](../docs/ai/ironfang-militia/militia-rules.md); [R058: ### Treasury](../docs/ai/ironfang-militia/militia-rules.md); [T016: ## Table 6-1: Militia Advancement](../docs/ai/ironfang-militia/militia-tables.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F01.fresh / 4-foundations | Phase View / Resolution Preview: New militia shows rank 1, training 0, treasury 10 gp and chosen focus. | PASS; planned: rules.F01.fresh; mapped: setup.defaults, setup.lifecycle; service: none |
| F01.import / 4-foundations | Phase View / Resolution Preview: Explicit mid-campaign state and focus survive initialization. | PASS; planned: rules.F01.import; mapped: setup.import, setup.confirmation, setup.form; service: none |
| F01.rank-cap / 4-foundations | Phase View / Resolution Preview: Rank cannot normally exceed 20 or highest PC level; departures are visible. | PASS; planned: rules.F01.rank-cap; mapped: setup.rank-cap; service: none |

## F02

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R005: ## Scope](../docs/ai/ironfang-militia/militia-rules.md); [R021: ### Rank](../docs/ai/ironfang-militia/militia-rules.md); [R028: ### Maximum Rank](../docs/ai/ironfang-militia/militia-rules.md); [T003: ## Rank and Reward Teams](../docs/ai/ironfang-militia/militia-tables.md); [T016: ## Table 6-1: Militia Advancement](../docs/ai/ironfang-militia/militia-tables.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F02.thresholds / 4-foundations | Phase View / Resolution Preview: Each training threshold is evaluated below, at and above its boundary. | PASS; planned: rules.F02.thresholds; mapped: rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.F02.rank-1-threshold, rules.F02.rank-2-threshold, rules.F02.rank-3-threshold, rules.F02.rank-4-threshold, rules.F02.rank-5-threshold, rules.F02.rank-6-threshold, rules.F02.rank-7-threshold, rules.F02.rank-8-threshold, rules.F02.rank-9-threshold, rules.F02.rank-10-threshold, rules.F02.rank-11-threshold, rules.F02.rank-12-threshold, rules.F02.rank-13-threshold, rules.F02.rank-14-threshold, rules.F02.rank-15-threshold, rules.F02.rank-16-threshold, rules.F02.rank-17-threshold, rules.F02.rank-18-threshold, rules.F02.rank-19-threshold, rules.F02.rank-20-threshold, rules.GATE.projection-parity; service: none |
| F02.retention / 4-foundations | Phase View / Resolution Preview: Training loss never reduces existing rank. | PASS; planned: rules.F02.retention; mapped: rules.F02.retention, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.pc-cap / 4-foundations | Phase View / Resolution Preview: Multiple rank gains stop at highest PC level; missing PC facts require input. | PASS; planned: rules.F02.pc-cap; mapped: rules.F02.pc-cap, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-1-threshold / 4-foundations | Phase View / Resolution Preview: Rank 1 minimum training is —; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-1-threshold; mapped: rules.F02.rank-1-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-2-threshold / 4-foundations | Phase View / Resolution Preview: Rank 2 minimum training is 10; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-2-threshold; mapped: rules.F02.rank-2-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-3-threshold / 4-foundations | Phase View / Resolution Preview: Rank 3 minimum training is 15; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-3-threshold; mapped: rules.F02.rank-3-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-4-threshold / 4-foundations | Phase View / Resolution Preview: Rank 4 minimum training is 20; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-4-threshold; mapped: rules.F02.rank-4-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-5-threshold / 4-foundations | Phase View / Resolution Preview: Rank 5 minimum training is 30; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-5-threshold; mapped: rules.F02.rank-5-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-6-threshold / 4-foundations | Phase View / Resolution Preview: Rank 6 minimum training is 40; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-6-threshold; mapped: rules.F02.rank-6-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-7-threshold / 4-foundations | Phase View / Resolution Preview: Rank 7 minimum training is 55; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-7-threshold; mapped: rules.F02.rank-7-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-8-threshold / 4-foundations | Phase View / Resolution Preview: Rank 8 minimum training is 75; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-8-threshold; mapped: rules.F02.rank-8-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-9-threshold / 4-foundations | Phase View / Resolution Preview: Rank 9 minimum training is 105; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-9-threshold; mapped: rules.F02.rank-9-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-10-threshold / 4-foundations | Phase View / Resolution Preview: Rank 10 minimum training is 160; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-10-threshold; mapped: rules.F02.rank-10-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-11-threshold / 4-foundations | Phase View / Resolution Preview: Rank 11 minimum training is 235; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-11-threshold; mapped: rules.F02.rank-11-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-12-threshold / 4-foundations | Phase View / Resolution Preview: Rank 12 minimum training is 330; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-12-threshold; mapped: rules.F02.rank-12-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-13-threshold / 4-foundations | Phase View / Resolution Preview: Rank 13 minimum training is 475; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-13-threshold; mapped: rules.F02.rank-13-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-14-threshold / 4-foundations | Phase View / Resolution Preview: Rank 14 minimum training is 665; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-14-threshold; mapped: rules.F02.rank-14-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-15-threshold / 4-foundations | Phase View / Resolution Preview: Rank 15 minimum training is 855; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-15-threshold; mapped: rules.F02.rank-15-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-16-threshold / 4-foundations | Phase View / Resolution Preview: Rank 16 minimum training is 1,350; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-16-threshold; mapped: rules.F02.rank-16-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-17-threshold / 4-foundations | Phase View / Resolution Preview: Rank 17 minimum training is 1,900; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-17-threshold; mapped: rules.F02.rank-17-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-18-threshold / 4-foundations | Phase View / Resolution Preview: Rank 18 minimum training is 2,700; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-18-threshold; mapped: rules.F02.rank-18-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-19-threshold / 4-foundations | Phase View / Resolution Preview: Rank 19 minimum training is 3,850; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-19-threshold; mapped: rules.F02.rank-19-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |
| F02.rank-20-threshold / 4-foundations | Phase View / Resolution Preview: Rank 20 minimum training is 5,350; compare below/exact/above while retaining existing rank and applying PC cap. | PASS; planned: rules.F02.rank-20-threshold; mapped: rules.F02.rank-20-threshold, rules.acceptance.foundation-ranks, rules.acceptance.foundation-thresholds, rules.GATE.projection-parity; service: none |

## F03

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R032: ### Organization Checks](../docs/ai/ironfang-militia/militia-rules.md); [R039: ### Focus](../docs/ai/ironfang-militia/militia-rules.md); [T016: ## Table 6-1: Militia Advancement](../docs/ai/ironfang-militia/militia-tables.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F03.rank-focus / 4-foundations | Phase View / Resolution Preview: All 20 ranks and three focuses use Table 6-1 focused and secondary bonuses. | PASS; planned: rules.F03.rank-focus; mapped: rules.acceptance.foundation-ranks, rules.F03.rank-1-focus, rules.F03.rank-2-focus, rules.F03.rank-3-focus, rules.F03.rank-4-focus, rules.F03.rank-5-focus, rules.F03.rank-6-focus, rules.F03.rank-7-focus, rules.F03.rank-8-focus, rules.F03.rank-9-focus, rules.F03.rank-10-focus, rules.F03.rank-11-focus, rules.F03.rank-12-focus, rules.F03.rank-13-focus, rules.F03.rank-14-focus, rules.F03.rank-15-focus, rules.F03.rank-16-focus, rules.F03.rank-17-focus, rules.F03.rank-18-focus, rules.F03.rank-19-focus, rules.F03.rank-20-focus, rules.GATE.projection-parity; service: none |
| F03.missing-focus / 4-foundations | Phase View / Resolution Preview: Missing focus requires selection; invalid focus is rejected. | PASS; planned: rules.F03.missing-focus; mapped: rules.acceptance.foundation-ranks, rules.acceptance.foundation-focus, rules.GATE.projection-parity; service: none |
| F03.composition / 4-foundations | Phase View / Resolution Preview: Negative, officer and contextual modifiers apply exactly once with explanations. | PASS; planned: rules.F03.composition; mapped: rules.F03.composition, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-1-focus / 4-foundations | Phase View / Resolution Preview: Rank 1: each of Loyalty/Secrecy/Security focuses gets +2; other checks get +0. | PASS; planned: rules.F03.rank-1-focus; mapped: rules.F03.rank-1-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-2-focus / 4-foundations | Phase View / Resolution Preview: Rank 2: each of Loyalty/Secrecy/Security focuses gets +3; other checks get +0. | PASS; planned: rules.F03.rank-2-focus; mapped: rules.F03.rank-2-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-3-focus / 4-foundations | Phase View / Resolution Preview: Rank 3: each of Loyalty/Secrecy/Security focuses gets +3; other checks get +1. | PASS; planned: rules.F03.rank-3-focus; mapped: rules.F03.rank-3-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-4-focus / 4-foundations | Phase View / Resolution Preview: Rank 4: each of Loyalty/Secrecy/Security focuses gets +4; other checks get +1. | PASS; planned: rules.F03.rank-4-focus; mapped: rules.F03.rank-4-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-5-focus / 4-foundations | Phase View / Resolution Preview: Rank 5: each of Loyalty/Secrecy/Security focuses gets +4; other checks get +1. | PASS; planned: rules.F03.rank-5-focus; mapped: rules.F03.rank-5-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-6-focus / 4-foundations | Phase View / Resolution Preview: Rank 6: each of Loyalty/Secrecy/Security focuses gets +5; other checks get +2. | PASS; planned: rules.F03.rank-6-focus; mapped: rules.F03.rank-6-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-7-focus / 4-foundations | Phase View / Resolution Preview: Rank 7: each of Loyalty/Secrecy/Security focuses gets +5; other checks get +2. | PASS; planned: rules.F03.rank-7-focus; mapped: rules.F03.rank-7-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-8-focus / 4-foundations | Phase View / Resolution Preview: Rank 8: each of Loyalty/Secrecy/Security focuses gets +6; other checks get +2. | PASS; planned: rules.F03.rank-8-focus; mapped: rules.F03.rank-8-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-9-focus / 4-foundations | Phase View / Resolution Preview: Rank 9: each of Loyalty/Secrecy/Security focuses gets +6; other checks get +3. | PASS; planned: rules.F03.rank-9-focus; mapped: rules.F03.rank-9-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-10-focus / 4-foundations | Phase View / Resolution Preview: Rank 10: each of Loyalty/Secrecy/Security focuses gets +7; other checks get +3. | PASS; planned: rules.F03.rank-10-focus; mapped: rules.F03.rank-10-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-11-focus / 4-foundations | Phase View / Resolution Preview: Rank 11: each of Loyalty/Secrecy/Security focuses gets +7; other checks get +3. | PASS; planned: rules.F03.rank-11-focus; mapped: rules.F03.rank-11-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-12-focus / 4-foundations | Phase View / Resolution Preview: Rank 12: each of Loyalty/Secrecy/Security focuses gets +8; other checks get +4. | PASS; planned: rules.F03.rank-12-focus; mapped: rules.F03.rank-12-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-13-focus / 4-foundations | Phase View / Resolution Preview: Rank 13: each of Loyalty/Secrecy/Security focuses gets +8; other checks get +4. | PASS; planned: rules.F03.rank-13-focus; mapped: rules.F03.rank-13-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-14-focus / 4-foundations | Phase View / Resolution Preview: Rank 14: each of Loyalty/Secrecy/Security focuses gets +9; other checks get +4. | PASS; planned: rules.F03.rank-14-focus; mapped: rules.F03.rank-14-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-15-focus / 4-foundations | Phase View / Resolution Preview: Rank 15: each of Loyalty/Secrecy/Security focuses gets +9; other checks get +5. | PASS; planned: rules.F03.rank-15-focus; mapped: rules.F03.rank-15-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-16-focus / 4-foundations | Phase View / Resolution Preview: Rank 16: each of Loyalty/Secrecy/Security focuses gets +10; other checks get +5. | PASS; planned: rules.F03.rank-16-focus; mapped: rules.F03.rank-16-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-17-focus / 4-foundations | Phase View / Resolution Preview: Rank 17: each of Loyalty/Secrecy/Security focuses gets +10; other checks get +5. | PASS; planned: rules.F03.rank-17-focus; mapped: rules.F03.rank-17-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-18-focus / 4-foundations | Phase View / Resolution Preview: Rank 18: each of Loyalty/Secrecy/Security focuses gets +11; other checks get +6. | PASS; planned: rules.F03.rank-18-focus; mapped: rules.F03.rank-18-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-19-focus / 4-foundations | Phase View / Resolution Preview: Rank 19: each of Loyalty/Secrecy/Security focuses gets +11; other checks get +6. | PASS; planned: rules.F03.rank-19-focus; mapped: rules.F03.rank-19-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F03.rank-20-focus / 4-foundations | Phase View / Resolution Preview: Rank 20: each of Loyalty/Secrecy/Security focuses gets +12; other checks get +6. | PASS; planned: rules.F03.rank-20-focus; mapped: rules.F03.rank-20-focus, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |

## F04

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [T016: ## Table 6-1: Militia Advancement](../docs/ai/ironfang-militia/militia-tables.md); [R076: ### Militia Actions](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F04.allowance / 4-foundations | Phase View / Resolution Preview: Rank 1 grants one action; remaining rank boundaries follow Table 6-1. | PASS; planned: rules.F04.allowance; mapped: rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.strategist / 4-foundations | Phase View / Resolution Preview: Strategist adds one action once even with multiple holders. | PASS; planned: rules.F04.strategist; mapped: rules.acceptance.foundation-ranks, rules.acceptance.strategist, rules.A04.order, rules.GATE.projection-parity; service: none |
| F04.shrink / 4-foundations | Phase View / Resolution Preview: Allowance shrink preserves occupied choices but blocks Confirmation until choices in unavailable slots are moved or cleared, or allowance is restored. A Rules Exception cannot bypass this. | PASS; planned: rules.F04.shrink; mapped: rules.F04.shrink, rules.F04.blocked-slot, rules.F04.workspace-hard-cap, rules.F04.capacity-guidance, rules.F04.obsolete-exception, rules.acceptance.foundation-ranks, rules.U01.recompute, rules.A04.order, rules.GATE.projection-parity; service: none |
| F04.rank-1-actions / 4-foundations | Phase View / Resolution Preview: Rank 1 baseline allowance is 1 actions. | PASS; planned: rules.F04.rank-1-actions; mapped: rules.F04.rank-1-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-2-actions / 4-foundations | Phase View / Resolution Preview: Rank 2 baseline allowance is 2 actions. | PASS; planned: rules.F04.rank-2-actions; mapped: rules.F04.rank-2-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-3-actions / 4-foundations | Phase View / Resolution Preview: Rank 3 baseline allowance is 2 actions. | PASS; planned: rules.F04.rank-3-actions; mapped: rules.F04.rank-3-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-4-actions / 4-foundations | Phase View / Resolution Preview: Rank 4 baseline allowance is 2 actions. | PASS; planned: rules.F04.rank-4-actions; mapped: rules.F04.rank-4-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-5-actions / 4-foundations | Phase View / Resolution Preview: Rank 5 baseline allowance is 2 actions. | PASS; planned: rules.F04.rank-5-actions; mapped: rules.F04.rank-5-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-6-actions / 4-foundations | Phase View / Resolution Preview: Rank 6 baseline allowance is 2 actions. | PASS; planned: rules.F04.rank-6-actions; mapped: rules.F04.rank-6-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-7-actions / 4-foundations | Phase View / Resolution Preview: Rank 7 baseline allowance is 3 actions. | PASS; planned: rules.F04.rank-7-actions; mapped: rules.F04.rank-7-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-8-actions / 4-foundations | Phase View / Resolution Preview: Rank 8 baseline allowance is 3 actions. | PASS; planned: rules.F04.rank-8-actions; mapped: rules.F04.rank-8-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-9-actions / 4-foundations | Phase View / Resolution Preview: Rank 9 baseline allowance is 3 actions. | PASS; planned: rules.F04.rank-9-actions; mapped: rules.F04.rank-9-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-10-actions / 4-foundations | Phase View / Resolution Preview: Rank 10 baseline allowance is 3 actions. | PASS; planned: rules.F04.rank-10-actions; mapped: rules.F04.rank-10-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-11-actions / 4-foundations | Phase View / Resolution Preview: Rank 11 baseline allowance is 4 actions. | PASS; planned: rules.F04.rank-11-actions; mapped: rules.F04.rank-11-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-12-actions / 4-foundations | Phase View / Resolution Preview: Rank 12 baseline allowance is 4 actions. | PASS; planned: rules.F04.rank-12-actions; mapped: rules.F04.rank-12-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-13-actions / 4-foundations | Phase View / Resolution Preview: Rank 13 baseline allowance is 4 actions. | PASS; planned: rules.F04.rank-13-actions; mapped: rules.F04.rank-13-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-14-actions / 4-foundations | Phase View / Resolution Preview: Rank 14 baseline allowance is 4 actions. | PASS; planned: rules.F04.rank-14-actions; mapped: rules.F04.rank-14-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-15-actions / 4-foundations | Phase View / Resolution Preview: Rank 15 baseline allowance is 5 actions. | PASS; planned: rules.F04.rank-15-actions; mapped: rules.F04.rank-15-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-16-actions / 4-foundations | Phase View / Resolution Preview: Rank 16 baseline allowance is 5 actions. | PASS; planned: rules.F04.rank-16-actions; mapped: rules.F04.rank-16-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-17-actions / 4-foundations | Phase View / Resolution Preview: Rank 17 baseline allowance is 5 actions. | PASS; planned: rules.F04.rank-17-actions; mapped: rules.F04.rank-17-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-18-actions / 4-foundations | Phase View / Resolution Preview: Rank 18 baseline allowance is 5 actions. | PASS; planned: rules.F04.rank-18-actions; mapped: rules.F04.rank-18-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-19-actions / 4-foundations | Phase View / Resolution Preview: Rank 19 baseline allowance is 6 actions. | PASS; planned: rules.F04.rank-19-actions; mapped: rules.F04.rank-19-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F04.rank-20-actions / 4-foundations | Phase View / Resolution Preview: Rank 20 baseline allowance is 6 actions. | PASS; planned: rules.F04.rank-20-actions; mapped: rules.F04.rank-20-actions, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |

## F05

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R101: ### Maximum Teams](../docs/ai/ironfang-militia/militia-rules.md); [R171: #### Missing](../docs/ai/ironfang-militia/militia-rules.md); [T003: ## Rank and Reward Teams](../docs/ai/ironfang-militia/militia-tables.md); [T016: ## Table 6-1: Militia Advancement](../docs/ai/ironfang-militia/militia-tables.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F05.caps / 4-foundations | Phase View / Resolution Preview: All Table 6-1 team caps count active, disabled and missing teams. | PASS; planned: rules.F05.caps; mapped: rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rewards / 4-foundations | Phase View / Resolution Preview: Reward teams do not consume capacity. | PASS; planned: rules.F05.rewards; mapped: rules.F05.rewards, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.identity / 4-foundations | Phase View / Resolution Preview: Repeated team types retain separate identities and consume separate capacity. | PASS; planned: rules.F05.identity; mapped: rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.order / 4-foundations | Phase View / Resolution Preview: Recruitment and dismissal in the same week work in either order when the resulting roster fits team capacity. | PASS; planned: rules.F05.order; mapped: rules.F05.final-roster, rules.F05.recruitment-capacity-outcomes, rules.F05.capacity-attribution, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.A06.capacity, rules.GATE.projection-parity; service: none |
| F05.rank-1-teams / 4-foundations | Phase View / Resolution Preview: Rank 1 cap is 2 non-reward teams. | PASS; planned: rules.F05.rank-1-teams; mapped: rules.F05.rank-1-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-2-teams / 4-foundations | Phase View / Resolution Preview: Rank 2 cap is 2 non-reward teams. | PASS; planned: rules.F05.rank-2-teams; mapped: rules.F05.rank-2-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-3-teams / 4-foundations | Phase View / Resolution Preview: Rank 3 cap is 3 non-reward teams. | PASS; planned: rules.F05.rank-3-teams; mapped: rules.F05.rank-3-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-4-teams / 4-foundations | Phase View / Resolution Preview: Rank 4 cap is 3 non-reward teams. | PASS; planned: rules.F05.rank-4-teams; mapped: rules.F05.rank-4-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-5-teams / 4-foundations | Phase View / Resolution Preview: Rank 5 cap is 4 non-reward teams. | PASS; planned: rules.F05.rank-5-teams; mapped: rules.F05.rank-5-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-6-teams / 4-foundations | Phase View / Resolution Preview: Rank 6 cap is 4 non-reward teams. | PASS; planned: rules.F05.rank-6-teams; mapped: rules.F05.rank-6-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-7-teams / 4-foundations | Phase View / Resolution Preview: Rank 7 cap is 4 non-reward teams. | PASS; planned: rules.F05.rank-7-teams; mapped: rules.F05.rank-7-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-8-teams / 4-foundations | Phase View / Resolution Preview: Rank 8 cap is 5 non-reward teams. | PASS; planned: rules.F05.rank-8-teams; mapped: rules.F05.rank-8-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-9-teams / 4-foundations | Phase View / Resolution Preview: Rank 9 cap is 5 non-reward teams. | PASS; planned: rules.F05.rank-9-teams; mapped: rules.F05.rank-9-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-10-teams / 4-foundations | Phase View / Resolution Preview: Rank 10 cap is 5 non-reward teams. | PASS; planned: rules.F05.rank-10-teams; mapped: rules.F05.rank-10-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-11-teams / 4-foundations | Phase View / Resolution Preview: Rank 11 cap is 6 non-reward teams. | PASS; planned: rules.F05.rank-11-teams; mapped: rules.F05.rank-11-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-12-teams / 4-foundations | Phase View / Resolution Preview: Rank 12 cap is 6 non-reward teams. | PASS; planned: rules.F05.rank-12-teams; mapped: rules.F05.rank-12-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-13-teams / 4-foundations | Phase View / Resolution Preview: Rank 13 cap is 6 non-reward teams. | PASS; planned: rules.F05.rank-13-teams; mapped: rules.F05.rank-13-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-14-teams / 4-foundations | Phase View / Resolution Preview: Rank 14 cap is 6 non-reward teams. | PASS; planned: rules.F05.rank-14-teams; mapped: rules.F05.rank-14-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-15-teams / 4-foundations | Phase View / Resolution Preview: Rank 15 cap is 7 non-reward teams. | PASS; planned: rules.F05.rank-15-teams; mapped: rules.F05.rank-15-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-16-teams / 4-foundations | Phase View / Resolution Preview: Rank 16 cap is 7 non-reward teams. | PASS; planned: rules.F05.rank-16-teams; mapped: rules.F05.rank-16-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-17-teams / 4-foundations | Phase View / Resolution Preview: Rank 17 cap is 7 non-reward teams. | PASS; planned: rules.F05.rank-17-teams; mapped: rules.F05.rank-17-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-18-teams / 4-foundations | Phase View / Resolution Preview: Rank 18 cap is 7 non-reward teams. | PASS; planned: rules.F05.rank-18-teams; mapped: rules.F05.rank-18-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-19-teams / 4-foundations | Phase View / Resolution Preview: Rank 19 cap is 7 non-reward teams. | PASS; planned: rules.F05.rank-19-teams; mapped: rules.F05.rank-19-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |
| F05.rank-20-teams / 4-foundations | Phase View / Resolution Preview: Rank 20 cap is 8 non-reward teams. | PASS; planned: rules.F05.rank-20-teams; mapped: rules.F05.rank-20-teams, rules.acceptance.team-capacity, rules.acceptance.foundation-ranks, rules.GATE.projection-parity; service: none |

## F06

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R044: ### Training](../docs/ai/ironfang-militia/militia-rules.md); [R058: ### Treasury](../docs/ai/ironfang-militia/militia-rules.md); [R064: ### Minimum Treasury](../docs/ai/ironfang-militia/militia-rules.md); [R069: ### Notoriety](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F06.notoriety / 4-foundations | Phase View / Resolution Preview: Calculated Notoriety is bounded 0–100 through additive effects. | PASS; planned: rules.F06.notoriety; mapped: rules.E88.covert-cap, rules.acceptance.notoriety-bounds, rules.GATE.projection-parity; service: none |
| F06.money / 4-foundations | Phase View / Resolution Preview: Minimum treasury is rank times 10 gp; spending and gains retain copper precision. | PASS; planned: rules.F06.money; mapped: rules.acceptance.foundation-ranks, rules.A03.payment, rules.U05.order, rules.GATE.projection-parity; service: none |
| F06.override / 4-foundations | Phase View / Resolution Preview: Explicit adjustments appear after the bounded baseline. | PASS; planned: rules.F06.override; mapped: rules.E88.covert-cap, rules.acceptance.notoriety-bounds, rules.GATE.projection-parity; service: none |
| F06.removed-action / 4-foundations | Phase View / Resolution Preview: Deselected actions contribute no stale resource totals. | PASS; planned: rules.F06.removed-action; mapped: rules.E88.covert-cap, rules.A08.removed, rules.A07.natural-one, rules.GATE.projection-parity; service: none |

## F07

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R051: ### Reputation](../docs/ai/ironfang-militia/militia-rules.md); [T046: ## Table 6-2: Reputation](../docs/ai/ironfang-militia/militia-tables.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F07.hostile / 4-foundations | Phase View / Resolution Preview: Hostile shows 1d4-day sightings, +5% prices and +5 social DC. | PASS; planned: rules.F07.hostile; mapped: rules.acceptance.reputation-rows, rules.GATE.projection-parity; service: none |
| F07.unfriendly / 4-foundations | Phase View / Resolution Preview: Unfriendly shows +2 social DC and +5 operating-settlement event result. | PASS; planned: rules.F07.unfriendly; mapped: rules.acceptance.reputation-rows, rules.GATE.projection-parity; service: none |
| F07.indifferent / 4-foundations | Phase View / Resolution Preview: Indifferent adds no modifier. | PASS; planned: rules.F07.indifferent; mapped: rules.acceptance.reputation-rows, rules.GATE.projection-parity; service: none |
| F07.friendly / 4-foundations | Phase View / Resolution Preview: Friendly shows -2 social DC and -5 operating-settlement event result. | PASS; planned: rules.F07.friendly; mapped: rules.acceptance.reputation-rows, rules.GATE.projection-parity; service: none |
| F07.helpful / 4-foundations | Phase View / Resolution Preview: Helpful grants -5% prices and +2 to exactly one eligible Activity check. | PASS; planned: rules.F07.helpful; mapped: rules.F07.helpful, rules.acceptance.reputation-rows, rules.settlements.modifiers, rules.A03.payment, rules.GATE.projection-parity; service: none |
| F07.effective / 4-foundations | Phase View / Resolution Preview: Refuge and Reduce Danger shifts affect the selected settlement; Market Day price effects compose. | PASS; planned: rules.F07.effective; mapped: rules.F07.effective, rules.acceptance.reputation-rows, rules.settlements.prices, rules.A15.duration, rules.A03.payment, rules.GATE.projection-parity; service: none |

## F08

Sources: [T016: ## Table 6-1: Militia Advancement](../docs/ai/ironfang-militia/militia-tables.md); [R106: ## PC Boons by Rank](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F08.skilled / 4-foundations | Phase View / Resolution Preview: Ranks 2/7/12/17 award one skill rank to each PC. | PASS; planned: rules.F08.skilled; mapped: rules.acceptance.foundation-boons, rules.F09.packages, rules.GATE.projection-parity; service: none |
| F08.gifts / 4-foundations | Phase View / Resolution Preview: Ranks 3/6/8/11/13/16/18 record the prescribed gift acknowledgement. | PASS; planned: rules.F08.gifts; mapped: rules.acceptance.foundation-boons, rules.F09.packages, rules.GATE.projection-parity; service: none |
| F08.titles / 4-foundations | Phase View / Resolution Preview: Ranks 4/9/14/19 record a title and eligible feat choice. | PASS; planned: rules.F08.titles; mapped: rules.acceptance.foundation-boons, rules.F09.packages, rules.GATE.projection-parity; service: none |
| F08.xp / 4-foundations | Phase View / Resolution Preview: Ranks 5/10/15/20 split the story XP among PCs. | PASS; planned: rules.F08.xp; mapped: rules.acceptance.foundation-boons, rules.acceptance.xp-shares, rules.GATE.projection-parity; service: none |
| F08.recipients / 4-foundations | Phase View / Resolution Preview: Multiple crossed milestones award once to PCs, excluding NPC officers and cohorts. | PASS; planned: rules.F08.recipients; mapped: rules.acceptance.foundation-boons, rules.acceptance.xp-shares, rules.U04.boons, rules.GATE.projection-parity; service: none |

## F09

Sources: [T016: ## Table 6-1: Militia Advancement](../docs/ai/ironfang-militia/militia-tables.md); [R114: ### Title Feat Packages](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| F09.context-money / 3-context | Preparation preserves integer copper values, including zero, separately from unknown money. | PASS; planned: context.absence, context.events-assets; mapped: context.absence, context.events-assets; service: none |
| F09.packages / 4-foundations | Phase View / Resolution Preview: Gift choices and title feats match the exact packages in the cited source. | PASS; planned: rules.F09.packages; mapped: rules.F09.packages, rules.acceptance.foundation-boons, rules.GATE.projection-parity; service: none |
| F09.xp-rounding / 4-foundations | Phase View / Resolution Preview: 1200/3200/6400/25600 XP split among PCs rounds down. | PASS; planned: rules.F09.xp-rounding; mapped: rules.F09.xp-rounding, rules.acceptance.foundation-boons, rules.acceptance.xp-shares, rules.GATE.projection-parity; service: none |
| F09.qualification / 4-foundations | Phase View / Resolution Preview: Champion feat requires qualification or an explicit Rules Exception. | PASS; planned: rules.F09.qualification; mapped: rules.acceptance.foundation-boons, rules.GATE.projection-parity; service: none |
| F09.acknowledgement / 4-foundations | Phase View / Resolution Preview: Chosen rewards and narrative acknowledgement persist in confirmed history. | PASS; planned: rules.F09.acknowledgement; mapped: rules.acceptance.foundation-boons, rules.GATE.projection-parity; service: none |

## O01

Sources: [R121: ## Officers](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| O01.roster-holders / 3-roster | Roster preparation retains multiple holders and character identities during removal or reassignment; legacy holders map to singleton assignments. | PASS; planned: roster.shared, roster.ui, roster.mapping; mapped: roster.shared, roster.ui, roster.mapping; service: none |
| O01.nonstack / 4-officers | Phase View / Resolution Preview: Multiple holders select one applicable role bonus rather than summing. | PASS; planned: rules.O01.nonstack; mapped: rules.acceptance.officer-abilities, rules.GATE.projection-parity; service: none |
| O01.commandants / 4-officers | Phase View / Resolution Preview: Commandant Hit Dice stack. | PASS; planned: rules.O01.commandants; mapped: rules.O01.commandants, rules.acceptance.officer-abilities, rules.acceptance.commandants, rules.GATE.projection-parity; service: none |
| O01.ordered-role / 4-officers | Phase View / Resolution Preview: Ordered assignment and removal recompute later checks. | PASS; planned: rules.O01.ordered-role; mapped: rules.acceptance.officer-abilities, rules.A04.order, rules.GATE.projection-parity; service: none |

## O02

Sources: [R125: ### Ambassador](../docs/ai/ironfang-militia/militia-rules.md); [R133: ### Marshal](../docs/ai/ironfang-militia/militia-rules.md); [R145: ### Spymaster](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| O02.ambassador / 4-officers | Phase View / Resolution Preview: Ambassador automatically uses the higher Constitution or Charisma modifier for Loyalty, and the highest applicable bonus across assigned Ambassadors; no manual selection. | PASS; planned: rules.O02.ambassador; mapped: rules.acceptance.officer-abilities, rules.GATE.projection-parity; service: none |
| O02.marshal / 4-officers | Phase View / Resolution Preview: Marshal automatically uses the higher Strength or Wisdom modifier for Security, and the highest applicable bonus across assigned Marshals; no manual selection. | PASS; planned: rules.O02.marshal; mapped: rules.acceptance.officer-abilities, rules.GATE.projection-parity; service: none |
| O02.spymaster / 4-officers | Phase View / Resolution Preview: Spymaster automatically uses the higher Dexterity or Intelligence modifier for Secrecy, and the highest applicable bonus across assigned Spymasters; no manual selection. | PASS; planned: rules.O02.spymaster; mapped: rules.acceptance.officer-abilities, rules.GATE.projection-parity; service: none |
| O02.identity / 4-officers | Phase View / Resolution Preview: Missing character records require correction and archived holders are flagged. The highest applicable modifier is used automatically, including ties and all-negative modifiers (for example, −1 beats −2). | PASS; planned: rules.O02.identity; mapped: rules.acceptance.officer-abilities, rules.GATE.projection-parity; service: none |

## O03

Sources: [R129: ### Commandant](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| O03.roster-hit-dice / 3-roster | Roster preparation retains explicit Commandant Hit Dice separately from level and reports unknown legacy Hit Dice for preflight resolution. | PASS; planned: roster.shared, roster.mapping, roster.ui; mapped: roster.shared, roster.mapping, roster.ui; service: none |
| O03.success / 4-officers | Phase View / Resolution Preview: Successful Drill adds all Commandant Hit Dice, including NPC HD differing from level. | PASS; planned: rules.O03.success; mapped: rules.acceptance.commandants, rules.GATE.projection-parity; service: none |
| O03.failure / 4-officers | Phase View / Resolution Preview: Failed Drill adds no Commandant training. | PASS; planned: rules.O03.failure; mapped: rules.A18.failure, rules.A72.projection-parity, rules.A16.rescue, rules.A15.failure, rules.A06.projection-parity, rules.A06.failure, rules.A05.failure, rules.A01.failure, rules.U02.failure, rules.acceptance.commandants, rules.GATE.projection-parity; service: none |
| O03.natural-one / 4-officers | Phase View / Resolution Preview: Natural 1 can still succeed and add Commandants while adding rolled Notoriety. | PASS; planned: rules.O03.natural-one; mapped: rules.A07.natural-one, rules.acceptance.commandants, rules.GATE.projection-parity; service: none |

## O04

Sources: [R137: ### Overseer](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| O04.secondary / 4-officers | Phase View / Resolution Preview: Overseer adds +1 to both secondary checks, not focused checks. | PASS; planned: rules.O04.secondary; mapped: rules.acceptance.overseer, rules.GATE.projection-parity; service: none |
| O04.event / 4-officers | Phase View / Resolution Preview: Organization checks during one selected event’s resolution receive the Overseer’s appropriate best ability modifier; support is not consumed by the first check. | PASS; planned: rules.O04.event; mapped: rules.O04.event-scope, rules.O04.persistent-selection, rules.acceptance.overseer, rules.EV03.modifiers, rules.GATE.projection-parity; service: none |
| O04.one-use / 4-officers | Phase View / Resolution Preview: Support can apply to multiple checks within the same event occurrence, but cannot also apply to a different event occurrence that week. | PASS; planned: rules.O04.one-use; mapped: rules.O04.one-use, rules.O04.support-identity, rules.acceptance.overseer, rules.GATE.projection-parity; service: none |
| O04.absent / 4-officers | Phase View / Resolution Preview: No Overseer contributes no bonus; included modifiers are not added twice. | PASS; planned: rules.O04.absent; mapped: rules.acceptance.overseer, rules.EV03.modifiers, rules.GATE.projection-parity; service: none |

## O05

Sources: [R149: ### Strategist](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| O05.slot / 4-officers | Phase View / Resolution Preview: The designated bonus action slot visibly shows “Strategist +2”, including when empty; only its action receives +2 to all related organization checks. | PASS; planned: rules.O05.slot; mapped: rules.O05.slot-label, rules.acceptance.strategist, rules.GATE.projection-parity; service: none |
| O05.holders / 4-officers | Phase View / Resolution Preview: Multiple Strategists grant one action and one designated bonus. | PASS; planned: rules.O05.holders; mapped: rules.acceptance.strategist, rules.GATE.projection-parity; service: none |
| O05.ordered / 4-officers | Phase View / Resolution Preview: Assigning, removing and reassigning Strategist recomputes later allowance without deleting choices. | PASS; planned: rules.O05.ordered; mapped: rules.O05.ordered, rules.acceptance.strategist, rules.A04.order, rules.GATE.projection-parity; service: none |

## O06

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R093: ### Officers and Teams Management](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| O06.roster-manager-warnings / 3-roster | Roster preparation validates campaign-scoped manager references and warns about manager limits without rejecting structurally valid rosters. | PASS; planned: roster.identities, roster.limits, roster.references; mapped: roster.identities, roster.limits, roster.references; service: none |
| O06.capacity / 4-officers | Phase View / Resolution Preview: PC or officer NPC manages max(1, Charisma modifier) teams; other NPC manages one. | PASS; planned: rules.O06.capacity; mapped: rules.A06.capacity, rules.O06.capacity, rules.acceptance.manager-checks, rules.F05.rewards, rules.GATE.projection-parity; service: none |
| O06.checks / 4-officers | Phase View / Resolution Preview: Each team check uses its own manager Charisma bonus exactly once. | PASS; planned: rules.O06.checks; mapped: rules.acceptance.manager-checks, rules.GATE.projection-parity; service: none |
| O06.changes / 4-officers | Phase View / Resolution Preview: The current manager applies to that team throughout the draft; changing the manager recomputes all of that team’s checks in the draft. | PASS; planned: rules.O06.changes; mapped: rules.acceptance.manager-checks, rules.GATE.projection-parity; service: none |
| O06.references / 4-officers | Phase View / Resolution Preview: Missing or archived manager identities are surfaced rather than fabricated. | PASS; planned: rules.O06.references; mapped: rules.acceptance.manager-checks, rules.GATE.projection-parity; service: none |

## U01

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R217: ## Upkeep Phase](../docs/ai/ironfang-militia/militia-rules.md); [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| U01.context-first-use / 3-context | Editing the proposed week records whether the militia is newly founded or resuming play, without executing Upkeep or changing committed state. Previous-week carryover applies only when a previous militia week exists. | PASS; planned: context.absence, context.shared; mapped: context.absence, context.shared; service: none |
| U01.sequence / 4-upkeep | Phase View / Resolution Preview: Upkeep precedes Activity, which precedes Event. | PASS; planned: rules.U01.sequence; mapped: rules.P06.baseline, rules.T07.same-week, rules.GATE.projection-parity; service: none |
| U01.first-use / 4-upkeep | Phase View / Resolution Preview: Only a newly founded militia’s first-ever week skips Upkeep. A militia set up to resume a later week runs Upkeep, even on its first week using the app. | PASS; planned: rules.U01.first-use; mapped: rules.U01.first-use, rules.GATE.projection-parity; service: none |
| U01.import / 4-upkeep | Phase View / Resolution Preview: Setup for an existing militia resuming a later week records that its first-ever week has already passed; using the app for the first time does not grant an Upkeep skip. | PASS; planned: rules.U01.import; mapped: rules.U01.import, rules.U01.setup-existing, rules.U01.setup-form, rules.U01.setup-server, rules.GATE.projection-parity; service: none |
| U01.recompute / 4-upkeep | Phase View / Resolution Preview: Earlier phase edits recompute downstream eligibility and outcomes. | PASS; planned: rules.U01.recompute; mapped: rules.U01.recompute, rules.GATE.projection-parity; service: none |

## U02

Sources: [R217: ## Upkeep Phase](../docs/ai/ironfang-militia/militia-rules.md); [R219: ### Step 1: Training Attrition](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| U02.success / 4-upkeep | Phase View / Resolution Preview: Loyalty total 10 or higher loses rolled 1d6 training. | PASS; planned: rules.U02.success; mapped: rules.U02.success, rules.U02.dice-boundaries, rules.GATE.projection-parity; service: none |
| U02.failure / 4-upkeep | Phase View / Resolution Preview: Loyalty total 9 or lower loses rolled 2d4 plus rank. | PASS; planned: rules.U02.failure; mapped: rules.U02.failure, rules.U02.dice-boundaries, rules.GATE.projection-parity; service: none |
| U02.natural-twenty / 4-upkeep | Phase View / Resolution Preview: Natural 20 gains rolled 1d6 training instead of losing training. | PASS; planned: rules.U02.natural-twenty; mapped: rules.U02.natural-twenty, rules.U02.dice-boundaries, rules.GATE.projection-parity; service: none |
| U02.modifiers / 4-upkeep | Phase View / Resolution Preview: Officer and queued modifiers compose once; Week of Pain doubles losses, not natural-20 gain. | PASS; planned: rules.U02.modifiers, rules.U02.provenance, rules.U02.consumption, rules.U02.sources, rules.U02.persistent-morale; mapped: rules.A16.rescue, rules.A16.raid-expiry, rules.U02.modifiers, rules.U02.provenance, rules.U02.consumption, rules.U02.sources, rules.U02.persistent-morale, rules.GATE.projection-parity; service: none |
| U02.readiness / 4-upkeep | Phase View / Resolution Preview: Missing required check or loss/gain dice prevents complete readiness. | PASS; planned: rules.U02.readiness; mapped: rules.U02.readiness, rules.GATE.projection-parity; service: none |

## U03

Sources: [R217: ## Upkeep Phase](../docs/ai/ironfang-militia/militia-rules.md); [R226: ### Step 2: Maximum-Notoriety Penalties](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| U03.threshold / 4-upkeep | Phase View / Resolution Preview: Notoriety 99 has no maximum penalty; 100 loses 1d20 plus rank. | PASS; planned: rules.U03.threshold; mapped: rules.U03.threshold, rules.GATE.projection-parity; service: none |
| U03.reputation / 4-upkeep | Phase View / Resolution Preview: Failed Loyalty DC15 reduces nearest settlement one step with Unfriendly floor. | PASS; planned: rules.U03.reputation; mapped: rules.U03.reputation, rules.GATE.projection-parity; service: none |
| U03.inputs / 4-upkeep | Phase View / Resolution Preview: Missing applicable die, check or settlement blocks Confirmation. | PASS; planned: rules.U03.inputs; mapped: rules.EV21.inputs, rules.E75.projection-parity, rules.EV12.inputs, rules.EV12.operation-scope, rules.EV12.settlement-exception, rules.E74.projection-parity, rules.A01.inputs, rules.A06.projection-parity, rules.U03.inputs, rules.GATE.projection-parity; service: none |
| U03.recompute / 4-upkeep | Phase View / Resolution Preview: Projected Notoriety and queued Loyalty modifiers control applicability and clear stale penalties. | PASS; planned: rules.U03.recompute; mapped: rules.U03.recompute, rules.GATE.projection-parity; service: none |

## U04

Sources: [R217: ## Upkeep Phase](../docs/ai/ironfang-militia/militia-rules.md); [R232: ### Step 3: Treasury-Shortage Penalties](../docs/ai/ironfang-militia/militia-rules.md); [R237: ### Step 4: Increase Rank](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| U04.shortage / 4-upkeep | Phase View / Resolution Preview: Treasury below rank times 10 after recovery payments loses rolled 2d4 plus rank. | PASS; planned: rules.U04.shortage, rules.U04.recovery-inputs; mapped: rules.U04.shortage, rules.U04.recovery-inputs, rules.GATE.projection-parity; service: none |
| U04.boundary / 4-upkeep | Phase View / Resolution Preview: Exactly minimum treasury avoids shortage; later deposits do not erase it. | PASS; planned: rules.U04.boundary; mapped: rules.U04.boundary, rules.GATE.projection-parity; service: none |
| U04.rank / 4-upkeep | Phase View / Resolution Preview: Rank increases use post-loss training, cross multiple thresholds and stop at PC cap. | PASS; planned: rules.U04.rank; mapped: rules.U04.rank, rules.GATE.projection-parity; service: none |
| U04.boons / 4-upkeep | Phase View / Resolution Preview: Each newly crossed boon is calculated immediately once. | PASS; planned: rules.U04.boons; mapped: rules.U04.boons, rules.GATE.projection-parity; service: none |

## U05

Sources: [R217: ## Upkeep Phase](../docs/ai/ironfang-militia/militia-rules.md); [R244: ### Step 5: Deposits and Withdrawals](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| U05.order / 4-upkeep | Phase View / Resolution Preview: Deposits and withdrawals are staged after preceding Upkeep steps. | PASS; planned: rules.U05.order, rules.U05.overdraft, rules.U05.officer-exception; mapped: rules.U05.order, rules.U05.overdraft, rules.U05.officer-exception, rules.GATE.projection-parity; service: none |
| U05.preview / 4-upkeep | Phase View / Resolution Preview: Preview includes all deposits and withdrawals before Event Theft. | PASS; planned: rules.U05.preview; mapped: rules.U05.preview, rules.GATE.projection-parity; service: none |
| U05.authority / 4-upkeep | Phase View / Resolution Preview: Allowed players can stage transfers; Confirmation applies them once under races. | PASS; planned: rules.U05.authority; mapped: rules.P81.workspace, rules.P81.gateway, rules.P80.authority, rules.P80.atomic, rules.P06.baseline, rules.GATE.projection-parity; service: none |

## U06

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [R248: ## Activity Phase](../docs/ai/ironfang-militia/militia-rules.md); [R567: ## Event: Theft (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| U06.cost-theft / 4-upkeep | Phase View / Resolution Preview: Activity costs precede Event Theft so theft uses remaining treasury. | PASS; planned: rules.U06.cost-theft; mapped: rules.P06.baseline, rules.GATE.projection-parity; service: none |
| U06.deposit-theft / 4-upkeep | Phase View / Resolution Preview: Deposits precede Event Theft and use persistent incoming-gain policy. | PASS; planned: rules.U06.deposit-theft; mapped: rules.P06.baseline, rules.U05.preview, rules.GATE.projection-parity; service: none |
| U06.action-order / 4-upkeep | Phase View / Resolution Preview: Reordering two dependent actions changes the later result and availability. | PASS; planned: rules.U06.action-order; mapped: rules.A06.capacity, rules.teams.action-upgrade-order, rules.economy.theft-order, rules.GATE.projection-parity; service: none |
| U06.failure / 4-upkeep | Phase View / Resolution Preview: Failed preceding operations recompute later capacity and costs without stale gains. | PASS; planned: rules.U06.failure; mapped: rules.teams.recruit-then-act, rules.A17.ordered, rules.economy.theft-order, rules.GATE.projection-parity; service: none |

## T01

Sources: [R178: ## Team Trees](../docs/ai/ironfang-militia/militia-rules.md); [T001: # Ironfang Militia Structured Tables](../docs/ai/ironfang-militia/militia-tables.md); [R180: ### Espionage](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| T01.recruit / 4-teams | Phase View / Resolution Preview: Moles are tier 1, size 3, Secrecy DC15. | PASS; planned: rules.T01.recruit; mapped: rules.teams.definitions, rules.A14.checks.moles, rules.GATE.projection-parity; service: none |
| T01.upgrade / 4-teams | Phase View / Resolution Preview: Propagandists cost 250 gp; Saboteurs and Spies each cost 1000 gp. | PASS; planned: rules.T01.upgrade; mapped: rules.T03.upgrade, rules.teams.all-edges, rules.teams.definitions, rules.GATE.projection-parity; service: none |
| T01.inherit / 4-teams | Phase View / Resolution Preview: Both branches inherit all earlier actions; cross-tree and skipped-tier upgrades warn. | PASS; planned: rules.T01.inherit; mapped: rules.teams.definitions, rules.teams.illegal-edges, rules.activity.acceptance-ready, rules.GATE.projection-parity; service: none |

## T02

Sources: [R178: ## Team Trees](../docs/ai/ironfang-militia/militia-rules.md); [T001: # Ironfang Militia Structured Tables](../docs/ai/ironfang-militia/militia-tables.md); [R187: ### Intelligence](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| T02.recruit / 4-teams | Phase View / Resolution Preview: Informants are tier 1, size 6, Loyalty DC10. | PASS; planned: rules.T02.recruit; mapped: rules.teams.definitions, rules.A14.checks.informants, rules.GATE.projection-parity; service: none |
| T02.upgrade / 4-teams | Phase View / Resolution Preview: Conspirators cost 250 gp; Scholars and Spellcasters each cost 1000 gp. | PASS; planned: rules.T02.upgrade; mapped: rules.teams.all-edges, rules.teams.definitions, rules.GATE.projection-parity; service: none |
| T02.inherit / 4-teams | Phase View / Resolution Preview: Both branches inherit all earlier actions; invalid edges warn. | PASS; planned: rules.T02.inherit; mapped: rules.teams.definitions, rules.teams.illegal-edges, rules.activity.acceptance-ready, rules.GATE.projection-parity; service: none |

## T03

Sources: [R178: ## Team Trees](../docs/ai/ironfang-militia/militia-rules.md); [T001: # Ironfang Militia Structured Tables](../docs/ai/ironfang-militia/militia-tables.md); [R194: ### Military](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| T03.recruit / 4-teams | Phase View / Resolution Preview: Defenders are tier 1, size 6, Security DC15. | PASS; planned: rules.T03.recruit; mapped: rules.teams.definitions, rules.A14.checks.defenders, rules.GATE.projection-parity; service: none |
| T03.upgrade / 4-teams | Phase View / Resolution Preview: Infiltrators cost 250 gp; Guardians and Specialists each display and charge 1000 gp. | PASS; planned: rules.T03.upgrade; mapped: rules.T03.upgrade, rules.teams.all-edges, rules.teams.definitions, rules.GATE.projection-parity; service: none |
| T03.inherit / 4-teams | Phase View / Resolution Preview: Both military branches inherit all earlier actions. | PASS; planned: rules.T03.inherit; mapped: rules.teams.definitions, rules.teams.illegal-edges, rules.activity.acceptance-ready, rules.GATE.projection-parity; service: none |

## T04

Sources: [R178: ## Team Trees](../docs/ai/ironfang-militia/militia-rules.md); [T001: # Ironfang Militia Structured Tables](../docs/ai/ironfang-militia/militia-tables.md); [R201: ### Treasury](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| T04.recruit / 4-teams | Phase View / Resolution Preview: Patrons are tier 1, size 6, Loyalty DC10. | PASS; planned: rules.T04.recruit; mapped: rules.teams.definitions, rules.A14.checks.patrons, rules.GATE.projection-parity; service: none |
| T04.upgrade / 4-teams | Phase View / Resolution Preview: Merchants cost 50 gp; Black Marketeers and Fixers each cost 200 gp. | PASS; planned: rules.T04.upgrade; mapped: rules.teams.all-edges, rules.teams.definitions, rules.GATE.projection-parity; service: none |
| T04.inherit / 4-teams | Phase View / Resolution Preview: Both treasury branches inherit all earlier actions. | PASS; planned: rules.T04.inherit; mapped: rules.teams.definitions, rules.teams.illegal-edges, rules.activity.acceptance-ready, rules.GATE.projection-parity; service: none |

## T05

Sources: [R178: ## Team Trees](../docs/ai/ironfang-militia/militia-rules.md); [R154: ## Teams](../docs/ai/ironfang-militia/militia-rules.md); [R443: ## Action: Upgrade Team](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| T05.recruit-act / 4-teams | Phase View / Resolution Preview: Successful new tier-1 recruits can act immediately when slots remain. | PASS; planned: rules.T05.recruit-act; mapped: rules.teams.recruit-then-act, rules.GATE.projection-parity; service: none |
| T05.failed-recruit / 4-teams | Phase View / Resolution Preview: Failed recruitment creates no team to act. | PASS; planned: rules.T05.failed-recruit; mapped: rules.teams.recruit-then-act, rules.GATE.projection-parity; service: none |
| T05.upgrade-act / 4-teams | Phase View / Resolution Preview: An upgraded team cannot act that Activity; ordered prior actions remain accounted for. | PASS; planned: rules.T05.upgrade-act; mapped: rules.T05.upgrade-act, rules.teams.action-upgrade-order, rules.teams.all-edges, rules.GATE.projection-parity; service: none |
| T05.repeat-upgrade / 4-teams | Phase View / Resolution Preview: Each team upgrades at most once per week; different teams can upgrade independently. | PASS; planned: rules.T05.repeat-upgrade; mapped: rules.teams.independent-upgrades, rules.GATE.projection-parity; service: none |

## T06

Sources: [R178: ## Team Trees](../docs/ai/ironfang-militia/militia-rules.md); [R248: ## Activity Phase](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| T06.roster-identities / 3-roster | Roster preparation preserves individual identities for repeated types and reward exemptions; cap warnings do not remove teams. | PASS; planned: roster.identities, roster.limits, roster.validation, roster.ui-teams; mapped: roster.identities, roster.limits, roster.validation, roster.ui-teams; service: none |
| T06.team-use / 4-teams | Phase View / Resolution Preview: One team normally takes one Activity action; two teams can select the same repeatable action. | PASS; planned: rules.T06.team-use; mapped: rules.teams.use-eligibility, rules.P82.cards, rules.GATE.projection-parity; service: none |
| T06.capability / 4-teams | Phase View / Resolution Preview: Team capability, condition and slot allowance produce specific eligibility warnings. | PASS; planned: rules.T06.capability; mapped: rules.teams.use-eligibility, rules.A04.order, rules.GATE.projection-parity; service: none |
| T06.lie-low / 4-teams | Phase View / Resolution Preview: Lie Low excludes other Activity actions. | PASS; planned: rules.T06.lie-low; mapped: rules.A12.exclusivity, rules.GATE.projection-parity; service: none |
| T06.drill / 4-teams | Phase View / Resolution Preview: Drill appears at most once per Activity. | PASS; planned: rules.T06.drill; mapped: rules.T06.drill-once, rules.GATE.projection-parity; service: none |
| T06.exception / 4-teams | Phase View / Resolution Preview: A shared reasoned Rules Exception permits an unusual choice without changing arithmetic. | PASS; planned: rules.T06.exception; mapped: rules.teams.use-eligibility, rules.A12.exclusivity, rules.P82.workspace, rules.GATE.projection-parity; service: none |

## T07

Sources: [R163: ### Team Conditions](../docs/ai/ironfang-militia/militia-rules.md); [R165: #### Disabled](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| T07.roster-conditions / 3-roster | Roster preparation retains independent disabled and missing conditions for individual teams of the same type. | PASS; planned: roster.shared, roster.ui-teams; mapped: roster.shared, roster.ui-teams; service: none |
| T07.disabled / 4-teams | Phase View / Resolution Preview: Disabled teams cannot act until recovery. | PASS; planned: rules.T07.disabled; mapped: rules.T07.individual-cost, rules.teams.use-eligibility, rules.GATE.projection-parity; service: none |
| T07.payment / 4-teams | Phase View / Resolution Preview: Each selected disabled team recovers at start-Upkeep for current minimum treasury. | PASS; planned: rules.T07.payment; mapped: rules.T07.individual-cost, rules.T07.same-week, rules.GATE.projection-parity; service: none |
| T07.narrative / 4-teams | Phase View / Resolution Preview: Narrative recovery records adjudication and enables same-week action. | PASS; planned: rules.T07.narrative; mapped: rules.T07.same-week, rules.P81.recovery-adjustment, rules.P81.recovery-arbitration, rules.GATE.projection-parity; service: none |
| T07.funds / 4-teams | Phase View / Resolution Preview: Insufficient recovery funds produce an advisory warning and exception path. | PASS; planned: rules.T07.funds; mapped: rules.T07.funds, rules.GATE.projection-parity; service: none |

## T08

Sources: [R163: ### Team Conditions](../docs/ai/ironfang-militia/militia-rules.md); [R171: #### Missing](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| T08.return / 4-teams | Phase View / Resolution Preview: Security DC15 returns a missing team at end-week, unavailable during Activity. | PASS; planned: rules.T08.return, rules.T08.manager-scope; mapped: rules.T08.return, rules.T08.manager-scope, rules.GATE.projection-parity; service: none |
| T08.failure / 4-teams | Phase View / Resolution Preview: Total 14 fails recovery; natural 1 permanently loses the team even with a high modifier. | PASS; planned: rules.T08.failure; mapped: rules.T08.return, rules.T08.natural-one, rules.GATE.projection-parity; service: none |
| T08.capacity / 4-teams | Phase View / Resolution Preview: Missing teams still count toward capacity. | PASS; planned: rules.T08.capacity; mapped: rules.A06.capacity, rules.F05.rewards, rules.GATE.projection-parity; service: none |
| T08.ordering / 4-teams | Phase View / Resolution Preview: Scheduled return, Sickness and Turn Around use explicit ordered condition outcomes. | PASS; planned: rules.T08.ordering; mapped: rules.EV18.ordering, rules.E03.outcome-replacement, rules.E03.replacement-sabotage, rules.E03.replacement-duplicates, rules.E75.projection-parity, rules.T08.condition-order, rules.EV13.no-early-return, rules.EV13.new-absence, rules.GATE.projection-parity; service: none |

## A01

Sources: [R254: ## Action: Activate Black Market](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A01.success / 4-activity | Phase View / Resolution Preview: Black Marketeers pay 50 gp and Secrecy DC20 opens a one-week market with 90% availability and 55% sale profile. | PASS; planned: rules.A01.success; mapped: rules.A01.success, rules.A06.projection-parity; service: none |
| A01.failure / 4-activity | Phase View / Resolution Preview: Total 19 fails, still charges 50 gp and adds 1d6 Notoriety. | PASS; planned: rules.A01.failure; mapped: rules.A01.failure, rules.A06.projection-parity; service: none |
| A01.lifecycle / 4-activity | Phase View / Resolution Preview: Separate markets retain independent targets and expire after one week. | PASS; planned: rules.A01.lifecycle; mapped: rules.A01.lifecycle, rules.A06.projection-parity; service: none |
| A01.inputs / 4-activity | Phase View / Resolution Preview: Missing check or failure die prevents complete readiness. | PASS; planned: rules.A01.inputs; mapped: rules.A01.inputs, rules.A06.projection-parity; service: none |

## A02

Sources: [R262: ## Action: Activate Refuge](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A02.reputation / 4-activity | Phase View / Resolution Preview: Conspirators, Scholars or Spellcasters make Hostile or Unfriendly refuge reputation one step better. | PASS; planned: rules.A02.reputation; mapped: rules.A02.reputation, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |
| A02.duration / 4-activity | Phase View / Resolution Preview: Refuge activation or renewal lasts one week. | PASS; planned: rules.A02.duration; mapped: rules.A15.duration, rules.A06.projection-parity, rules.A02.duration, rules.GATE.projection-parity; service: none |
| A02.interactions / 4-activity | Phase View / Resolution Preview: Active refuge is available to same-week rescue and scoped Raid outcomes. | PASS; planned: rules.A02.interactions; mapped: rules.A02.rescue-order, rules.A17.ordered, rules.EV15.base, rules.settlements.prices, rules.GATE.projection-parity; service: none |

## A03

Sources: [R268: ## Action: Broker Market](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A03.profiles / 4-activity | Phase View / Resolution Preview: Merchants broker small-town markets; Black Marketeers and Fixers broker small-city markets. | PASS; planned: rules.A03.profiles; mapped: rules.A03.profiles, rules.A06.projection-parity; service: none |
| A03.payment / 4-activity | Phase View / Resolution Preview: Activation costs 100 gp plus all purchases paid upfront. | PASS; planned: rules.A03.payment; mapped: rules.A03.payment, rules.A06.projection-parity; service: none |
| A03.delivery / 4-activity | Phase View / Resolution Preview: Each order arrives next Activity, independently of Special Order day timing. | PASS; planned: rules.A03.delivery; mapped: rules.A03.delivery, rules.A06.projection-parity; service: none |
| A03.expiry / 4-activity | Phase View / Resolution Preview: Market duration and delivered item availability follow the source without duplicate receipt. | PASS; planned: rules.A03.expiry; mapped: rules.EV24.twice, rules.E76.projection-parity, rules.A03.expiry, rules.A06.projection-parity; service: none |

## A04

Sources: [R277: ## Action: Change Officer Role](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A04.pc / 4-activity | Phase View / Resolution Preview: One no-team action changes one PC role; ally or cohort departure needs Rules Exception. | PASS; planned: rules.A04.pc; mapped: rules.A04.pc, rules.GATE.projection-parity; service: none |
| A04.move / 4-activity | Phase View / Resolution Preview: Move or unassign preserves character records. | PASS; planned: rules.A04.move; mapped: rules.A04.pc, rules.A04.order, rules.GATE.projection-parity; service: none |
| A04.order / 4-activity | Phase View / Resolution Preview: Role changes affect later checks and consume their own actions. | PASS; planned: rules.A04.order; mapped: rules.EV20.order, rules.E74.projection-parity, rules.A04.order, rules.GATE.projection-parity; service: none |

## A05

Sources: [R283: ## Action: Covert Action](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A05.next / 4-activity | Phase View / Resolution Preview: Spies give manager Charisma to all d20 rolls of the immediately following action only. | PASS; planned: rules.A05.next; mapped: rules.E88.covert-cap, rules.A05.next, rules.A72.projection-parity; service: none |
| A05.success / 4-activity | Phase View / Resolution Preview: Successful target action produces no action Notoriety, including natural-1 success. | PASS; planned: rules.A05.success; mapped: rules.E88.covert-cap, rules.A05.success, rules.A72.projection-parity; service: none |
| A05.failure / 4-activity | Phase View / Resolution Preview: Failed target action keeps its Notoriety; unrelated same-type actions gain no benefit. | PASS; planned: rules.A05.failure; mapped: rules.E88.covert-cap, rules.A05.failure, rules.A72.projection-parity; service: none |
| A05.contact / 4-activity | Phase View / Resolution Preview: Alternative contact or cache at a chosen site lasts one week. | PASS; planned: rules.A05.contact; mapped: rules.A05.contact, rules.A72.projection-parity; service: none |
| A05.raid / 4-activity | Phase View / Resolution Preview: Contact rescue and Raid override compose identically in browser and server. | PASS; planned: rules.A05.raid; mapped: rules.A05.raid, rules.A72.projection-parity; service: none |

## A06

Sources: [R291: ## Action: Dismiss Team](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A06.success / 4-activity | Phase View / Resolution Preview: Loyalty DC10 removes the chosen team. | PASS; planned: rules.A06.success; mapped: rules.A06.success-repeat, rules.GATE.projection-parity; service: none |
| A06.failure / 4-activity | Phase View / Resolution Preview: Loyalty total 9 still removes the team and adds rolled 1d6 Notoriety. | PASS; planned: rules.A06.failure; mapped: rules.A06.failure, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |
| A06.capacity / 4-activity | Phase View / Resolution Preview: Removal frees capacity for recruitment in the same week regardless of slot order; repeated dismissal cannot remove the same team twice. | PASS; planned: rules.A06.capacity; mapped: rules.A06.capacity, rules.A06.success-repeat, rules.GATE.projection-parity; service: none |

## A07

Sources: [R298: ## Action: Drill Militia](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A07.cost / 4-activity | Phase View / Resolution Preview: One no-team Drill costs rank times 10 gp even on failure. | PASS; planned: rules.A07.cost; mapped: rules.A07.cost, rules.GATE.projection-parity; service: none |
| A07.success / 4-activity | Phase View / Resolution Preview: Loyalty DC10 plus rank gains rolled 2d6 plus summed Commandant Hit Dice. | PASS; planned: rules.A07.success; mapped: rules.A07.success, rules.activity.persistent.low_morale, rules.GATE.projection-parity; service: none |
| A07.natural-one / 4-activity | Phase View / Resolution Preview: Natural 1 can succeed but also adds rolled 1d6 Notoriety. | PASS; planned: rules.A07.natural-one; mapped: rules.A14.natural-one, rules.A07.natural-one, rules.GATE.projection-parity; service: none |
| A07.maximum / 4-activity | Phase View / Resolution Preview: At maximum rank Drill is unavailable by baseline with a reasoned exception path. | PASS; planned: rules.A07.maximum; mapped: rules.T06.drill-once, rules.GATE.projection-parity; service: none |
| A07.removed / 4-activity | Phase View / Resolution Preview: Removing or failing Drill removes its gain; no staged Drill means no Drill training. | PASS; planned: rules.A07.removed; mapped: rules.A08.removed, rules.A06.projection-parity, rules.A07.natural-one, rules.A07.cost, rules.GATE.projection-parity; service: none |

## A08

Sources: [R308: ## Action: Earn Gold](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A08.tiers / 4-activity | Phase View / Resolution Preview: Treasury teams earn Loyalty total times their tier for tiers 1/2/3. | PASS; planned: rules.A08.tiers; mapped: rules.A08.tiers, rules.A06.projection-parity; service: none |
| A08.natural-one / 4-activity | Phase View / Resolution Preview: Natural 1 still earns gold and adds rolled 1d6 Notoriety. | PASS; planned: rules.A08.natural-one; mapped: rules.A09.information, rules.A08.natural-one, rules.A06.projection-parity; service: none |
| A08.composition / 4-activity | Phase View / Resolution Preview: Queued and manager bonuses affect earned gold exactly once per team. | PASS; planned: rules.A08.composition; mapped: rules.A18.composition, rules.A72.projection-parity, rules.A08.composition, rules.A06.projection-parity; service: none |
| A08.removed / 4-activity | Phase View / Resolution Preview: Clearing an action removes its earnings; invalid or exceptional negative outcomes remain explicit. | PASS; planned: rules.A08.removed; mapped: rules.A08.removed, rules.A06.projection-parity; service: none |

## A09

Sources: [R315: ## Action: Gather Information](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A09.tiers / 4-activity | Phase View / Resolution Preview: Intelligence teams add twice their tier to Secrecy against DC15. | PASS; planned: rules.A09.tiers; mapped: rules.A09.information, rules.A09.boundaries, rules.GATE.projection-parity; service: none |
| A09.natural-one / 4-activity | Phase View / Resolution Preview: Natural 1 is not automatic failure and adds 1d6 Notoriety. | PASS; planned: rules.A09.natural-one; mapped: rules.A09.information, rules.A09.boundaries, rules.GATE.projection-parity; service: none |
| A09.acknowledgement / 4-activity | Phase View / Resolution Preview: Successful intelligence requires recorded GM outcome acknowledgement. | PASS; planned: rules.A09.acknowledgement; mapped: rules.A17.stale, rules.GATE.projection-parity; service: none |
| A09.repeat / 4-activity | Phase View / Resolution Preview: Separate teams retain independent checks and outcomes. | PASS; planned: rules.A09.repeat; mapped: rules.A09.repeat, rules.GATE.projection-parity; service: none |

## A10

Sources: [R322: ## Action: Guarantee Event](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A10.cost / 4-activity | Phase View / Resolution Preview: No-team Guarantee Event costs rank times 10 gp and adds 1d6 Notoriety per action. | PASS; planned: rules.A10.cost; mapped: rules.A10.cost, rules.A72.projection-parity; service: none |
| A10.choice / 4-activity | Phase View / Resolution Preview: Both event rolls and explicit chosen result are required. | PASS; planned: rules.A10.choice; mapped: rules.A10.choice, rules.A72.projection-parity; service: none |
| A10.roll-twice / 4-activity | Phase View / Resolution Preview: Chosen Roll Twice expands to two valid final events. | PASS; planned: rules.A10.roll-twice; mapped: rules.A10.roll-twice, rules.A72.projection-parity; service: none |
| A10.precedence / 4-activity | Phase View / Resolution Preview: Forced All Is Calm and Sabotage use explicit event precedence rather than stale inputs. | PASS; planned: rules.A10.precedence; mapped: rules.A10.precedence, rules.A72.projection-parity; service: none |

## A11

Sources: [R329: ## Action: Knowledge Check](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A11.dc / 4-activity | Phase View / Resolution Preview: Scholars add rank to modified Secrecy total to determine achieved Knowledge DC. | PASS; planned: rules.A11.dc; mapped: rules.A11.knowledge, rules.GATE.projection-parity; service: none |
| A11.record / 4-activity | Phase View / Resolution Preview: Identification or evaluation outcome and acknowledgement remain in confirmed source. | PASS; planned: rules.A11.record; mapped: rules.A11.knowledge, rules.A17.stale, rules.GATE.projection-parity; service: none |

## A12

Sources: [R336: ## Action: Lie Low](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A12.exclusive / 4-activity | Phase View / Resolution Preview: No-team Lie Low is normally the only Activity action. | PASS; planned: rules.A12.exclusive; mapped: rules.A12.exclusivity, rules.GATE.projection-parity; service: none |
| A12.count / 4-activity | Phase View / Resolution Preview: Notoriety reduction counts active, disabled, missing and bonus teams. | PASS; planned: rules.A12.count; mapped: rules.A12.exclusivity, rules.A12.count-floor, rules.GATE.projection-parity; service: none |
| A12.floor / 4-activity | Phase View / Resolution Preview: Zero teams reduces nothing; reduction below zero stops at baseline zero. | PASS; planned: rules.A12.floor; mapped: rules.A12.count-floor, rules.GATE.projection-parity; service: none |
| A12.exception / 4-activity | Phase View / Resolution Preview: Additional actions require a reasoned Rules Exception without rewriting the reduction. | PASS; planned: rules.A12.exception; mapped: rules.A12.exclusivity, rules.GATE.projection-parity; service: none |

## A13

Sources: [R342: ## Action: Manipulate Events](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A13.team / 4-activity | Phase View / Resolution Preview: Available Guardians guarantee an event with two rolls and one chosen result. | PASS; planned: rules.A13.team; mapped: rules.A13.team, rules.A72.projection-parity; service: none |
| A13.chooser / 4-activity | Phase View / Resolution Preview: Any player can choose which of the two guaranteed event results occurs; the choice needs no chooser identity. | PASS; planned: rules.A13.chooser; mapped: rules.A13.chooser, rules.A72.projection-parity; service: none |
| A13.composition / 4-activity | Phase View / Resolution Preview: Guarantee Event and selected Roll Twice do not accidentally duplicate or discard results. | PASS; planned: rules.A13.composition; mapped: rules.A13.composition, rules.A72.projection-parity; service: none |

## A14

Sources: [R349: ## Action: Recruit Team](../docs/ai/ironfang-militia/militia-rules.md); [R154: ## Teams](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A14.checks / 4-activity | Phase View / Resolution Preview: Tier-1 recruitment uses each of the four tree-specific checks and DCs. | PASS; planned: rules.A14.checks; mapped: rules.activity.persistent.double_agent, rules.A14.checks.patrons, rules.A14.checks.informants, rules.A14.checks.moles, rules.A14.checks.defenders, rules.GATE.projection-parity; service: none |
| A14.capacity / 4-activity | Phase View / Resolution Preview: Recruitment checks non-reward team capacity after the week’s Activity actions, accounting for dismissal in either order even on dismissal failure. | PASS; planned: rules.A14.capacity; mapped: rules.A06.capacity, rules.GATE.projection-parity; service: none |
| A14.natural-one / 4-activity | Phase View / Resolution Preview: Natural 1 can succeed but adds 1d6 Notoriety. | PASS; planned: rules.A14.natural-one; mapped: rules.A14.natural-one, rules.GATE.projection-parity; service: none |
| A14.identity / 4-activity | Phase View / Resolution Preview: Successful repeated types create independent teams that may act immediately. | PASS; planned: rules.A14.identity; mapped: rules.A06.capacity, rules.teams.recruit-then-act, rules.GATE.projection-parity; service: none |

## A15

Sources: [R356: ## Action: Reduce Danger](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A15.success / 4-activity | Phase View / Resolution Preview: Military team Security DC15 gives temporary +1 settlement reputation and open movement reminder. | PASS; planned: rules.A15.success; mapped: rules.A15.success, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |
| A15.failure / 4-activity | Phase View / Resolution Preview: Total 14 adds 1d4 Notoriety without a reputation gain. | PASS; planned: rules.A15.failure; mapped: rules.A15.failure, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |
| A15.duration / 4-activity | Phase View / Resolution Preview: Temporary shift expires after one week and respects secured-town context. | PASS; planned: rules.A15.duration; mapped: rules.A15.duration, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |
| A15.theft / 4-activity | Phase View / Resolution Preview: Successful Reduce Danger permanently ends applicable persistent Theft. | PASS; planned: rules.A15.theft; mapped: rules.A15.theft, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |

## A16

Sources: [R363: ## Action: Rescue Character](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A16.success / 4-activity | Phase View / Resolution Preview: Upgraded military team Security DC10 plus level rescues to a valid location/refuge and adds level Notoriety. | PASS; planned: rules.A16.success; mapped: rules.A16.rescue, rules.A17.ordered, rules.GATE.projection-parity; service: none |
| A16.failure / 4-activity | Phase View / Resolution Preview: Failed rescue adds floor(level divided by 2) Notoriety. | PASS; planned: rules.A16.failure; mapped: rules.A16.rescue, rules.GATE.projection-parity; service: none |
| A16.targets / 4-activity | Phase View / Resolution Preview: Missing or invalid target and inactive destination block completion; direct rescue records GM adjudication. | PASS; planned: rules.A16.targets; mapped: rules.A16.eligibility, rules.A71.inputs, rules.GATE.projection-parity; service: none |
| A16.modifiers / 4-activity | Phase View / Resolution Preview: Raid DC override and Covert Action suppression apply once. | PASS; planned: rules.A16.modifiers; mapped: rules.A16.rescue, rules.A16.raid-expiry, rules.A05.raid, rules.A05.success, rules.GATE.projection-parity; service: none |

## A17

Sources: [R372: ## Action: Restore Character](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A17.party / 4-activity | Phase View / Resolution Preview: Spellcasters provide the prescribed free party restoration modes. | PASS; planned: rules.A17.party; mapped: rules.A17.restore, rules.A17.multiple, rules.A17.death, rules.GATE.projection-parity; service: none |
| A17.single / 4-activity | Phase View / Resolution Preview: Single-target restoration modes cost 1125, 6125, 1700 or 1650 gp as specified. | PASS; planned: rules.A17.single; mapped: rules.A17.restore, rules.A17.death, rules.GATE.projection-parity; service: none |
| A17.presence / 4-activity | Phase View / Resolution Preview: Required body must be at HQ or active refuge; captured or invalid targets need correction. | PASS; planned: rules.A17.presence; mapped: rules.A17.readiness, rules.A17.ordered, rules.GATE.projection-parity; service: none |
| A17.multiple / 4-activity | Phase View / Resolution Preview: Multiple restorations sum their distinct costs and retain custom adjudication reasons. | PASS; planned: rules.A17.multiple; mapped: rules.A17.multiple, rules.A17.readiness, rules.GATE.projection-parity; service: none |

## A18

Sources: [R386: ## Action: Sabotage](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A18.availability / 4-activity | Phase View / Resolution Preview: Available Saboteurs can react during Event; disabled or otherwise used teams show eligibility warning. | PASS; planned: rules.A18.availability; mapped: rules.A18.availability, rules.A72.projection-parity; service: none |
| A18.success / 4-activity | Phase View / Resolution Preview: Check DC15 plus rank negates only the selected event and still adds rolled 1d6 Notoriety. | PASS; planned: rules.A18.success; mapped: rules.A18.success, rules.A72.projection-parity; service: none |
| A18.failure / 4-activity | Phase View / Resolution Preview: Failed Sabotage still adds 1d6 Notoriety. | PASS; planned: rules.A18.failure; mapped: rules.A18.failure, rules.A72.projection-parity; service: none |
| A18.composition / 4-activity | Phase View / Resolution Preview: Manager, queue and Overseer modifiers apply exactly once; missing dice block readiness. | PASS; planned: rules.A18.composition; mapped: rules.A18.composition, rules.A72.projection-parity; service: none |

## A19

Sources: [R393: ## Action: Secure Cache](../docs/ai/ironfang-militia/militia-rules.md); [R605: ## Caches](../docs/ai/ironfang-militia/militia-rules.md); [T091: ## Cache Thresholds](../docs/ai/ironfang-militia/militia-tables.md); [R607: ### Minor Cache](../docs/ai/ironfang-militia/militia-rules.md); [R612: ### Intermediate Cache](../docs/ai/ironfang-militia/militia-rules.md); [R617: ### Major Cache](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A19.minor / 4-activity | Phase View / Resolution Preview: Minor cache limits are 5 lb and 900 gp at DC15. | PASS; planned: rules.A19.minor; mapped: rules.A19.minor, rules.A06.projection-parity; service: none |
| A19.intermediate / 4-activity | Phase View / Resolution Preview: Intermediate cache limits are 10 lb and 2500 gp at DC20. | PASS; planned: rules.A19.intermediate; mapped: rules.A19.intermediate, rules.A06.projection-parity; service: none |
| A19.major / 4-activity | Phase View / Resolution Preview: Major cache has 20 lb limit or extradimensional storage, no value cap, DC30. | PASS; planned: rules.A19.major; mapped: rules.A19.major, rules.A06.projection-parity; service: none |
| A19.secure / 4-activity | Phase View / Resolution Preview: Secure location adds 5 DC and requires tier-3 Saboteurs or Spies. | PASS; planned: rules.A19.secure; mapped: rules.A19.secure, rules.A19.double-agent, rules.A06.projection-parity; service: none |
| A19.failure / 4-activity | Phase View / Resolution Preview: Failed placement returns the cache next Activity. | PASS; planned: rules.A19.failure; mapped: rules.A19.failure, rules.A06.projection-parity; service: none |
| A19.retrieve / 4-activity | Phase View / Resolution Preview: Placement and retrieval have distinct targets and apply modifiers once; unused retrieval has no effect. | PASS; planned: rules.A19.retrieve; mapped: rules.A19.retrieve, rules.A06.projection-parity; service: none |

## A20

Sources: [R407: ## Action: Special](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A20.description / 4-activity | Phase View / Resolution Preview: No-team Special action records GM-defined description and outcome acknowledgement. | PASS; planned: rules.A20.description; mapped: rules.A20.special, rules.A17.stale, rules.A71.inputs, rules.GATE.projection-parity; service: none |
| A20.adjustments / 4-activity | Phase View / Resolution Preview: Zero or nonzero cost/results are explicit; outcome adjustments and eligibility exceptions remain distinct. | PASS; planned: rules.A20.adjustments; mapped: rules.A20.special, rules.A17.readiness, rules.P06.baseline, rules.teams.use-eligibility, rules.GATE.projection-parity; service: none |

## A21

Sources: [R412: ## Action: Special Order](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A21.context-orders / 3-context | Preparation retains copper precision, due-day, enchantment duration and explicit receipt separately from next-Activity marketplace timing. | PASS; planned: context.events-assets, context.delivery, context.ui-receipt, context.ui-decimal; mapped: context.events-assets, context.delivery, context.ui-receipt, context.ui-decimal; service: none |
| A21.price / 4-activity | Phase View / Resolution Preview: Fixers order one item or enchantment with 5% discount paid upfront at Confirmation. | PASS; planned: rules.A21.price; mapped: rules.A21.price, rules.A06.projection-parity; service: none |
| A21.ordinary / 4-activity | Phase View / Resolution Preview: Ordinary delivery uses entered 2d6 days including 2 and 12 boundaries. | PASS; planned: rules.A21.ordinary; mapped: rules.A21.ordinary, rules.A06.projection-parity; service: none |
| A21.expedite / 4-activity | Phase View / Resolution Preview: Expediting adds 900 gp for one-day delivery. | PASS; planned: rules.A21.expedite; mapped: rules.A21.expedite, rules.A06.projection-parity; service: none |
| A21.enchantment / 4-activity | Phase View / Resolution Preview: Enchantment adds source-prescribed time per 1000 gp without losing due-day information. | PASS; planned: rules.A21.enchantment; mapped: rules.A21.enchantment, rules.A06.projection-parity; service: none |
| A21.receipt / 4-activity | Phase View / Resolution Preview: Orders crossing weeks retain exact due day and explicit receipt applied once. | PASS; planned: rules.A21.receipt; mapped: rules.A21.receipt, rules.A21.inputs, rules.A21.removed, rules.A06.projection-parity; service: none |

## A22

Sources: [R423: ## Action: Spread Propaganda](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A22.check / 4-activity | Phase View / Resolution Preview: Espionage tier-2/3 pays 100 gp and rolls Loyalty DC20 or DC25 under occupation. | PASS; planned: rules.A22.check; mapped: rules.A22.check, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |
| A22.attempt / 4-activity | Phase View / Resolution Preview: Each settlement allows one attempt per Activity even on failure; two settlements are independent. | PASS; planned: rules.A22.attempt; mapped: rules.A22.attempt, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |
| A22.success / 4-activity | Phase View / Resolution Preview: Success improves permanent reputation by one step up to Helpful. | PASS; planned: rules.A22.success; mapped: rules.A22.success, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |
| A22.adjudication / 4-activity | Phase View / Resolution Preview: GM-disallowed or impossible targets show exception path; malformed references still block. | PASS; planned: rules.A22.adjudication; mapped: rules.A22.adjudication, rules.A06.projection-parity, rules.GATE.projection-parity; service: none |

## A23

Sources: [R432: ## Action: Strike Team](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A23.combat / 4-activity | Phase View / Resolution Preview: Specialists provide +2 competence attack, damage and saves at chosen location next week for half the militia rank rounded down, with a minimum of one round. | PASS; planned: rules.A23.combat; mapped: rules.A23.support, rules.GATE.projection-parity; service: none |
| A23.rank-one / 4-activity | Phase View / Resolution Preview: Strike Team support has a minimum duration of one round, including at rank 1. | PASS; planned: rules.A23.rank-one; mapped: rules.A23.support, rules.GATE.projection-parity; service: none |
| A23.extraction / 4-activity | Phase View / Resolution Preview: Alternative records stabilization, gentle repose CL12 and body extraction. | PASS; planned: rules.A23.extraction; mapped: rules.A23.support, rules.GATE.projection-parity; service: none |
| A23.duration / 4-activity | Phase View / Resolution Preview: Support lasts following week, requires location and once-use acknowledgement. | PASS; planned: rules.A23.duration; mapped: rules.A23.support, rules.A71.inputs, rules.A17.stale, rules.GATE.projection-parity; service: none |

## A24

Sources: [R443: ## Action: Upgrade Team](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| A24.edges / 4-activity | Phase View / Resolution Preview: No-team Upgrade uses the selected valid tree edge and listed cost. | PASS; planned: rules.A24.edges; mapped: rules.A24.tree, rules.teams.all-edges, rules.GATE.projection-parity; service: none |
| A24.per-team / 4-activity | Phase View / Resolution Preview: Multiple distinct teams may upgrade but one team cannot upgrade twice per week. | PASS; planned: rules.A24.per-team; mapped: rules.teams.independent-upgrades, rules.GATE.projection-parity; service: none |
| A24.preserve / 4-activity | Phase View / Resolution Preview: Upgrade preserves manager and inherited capabilities while preventing same-Activity action. | PASS; planned: rules.A24.preserve; mapped: rules.teams.all-edges, rules.teams.definitions, rules.teams.action-upgrade-order, rules.GATE.projection-parity; service: none |
| A24.warning / 4-activity | Phase View / Resolution Preview: Insufficient funds or illegal edge needs explicit exception; malformed target blocks. | PASS; planned: rules.A24.warning; mapped: rules.A24.warning, rules.GATE.projection-parity; service: none |

## E01

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R081: ### Event Chance](../docs/ai/ironfang-militia/militia-rules.md); [R452: ### Event Trigger](../docs/ai/ironfang-militia/militia-rules.md); [T056: ## Table 6-3: Militia Events (d%)](../docs/ai/ironfang-militia/militia-tables.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| E01.bounds / 4-events | Phase View / Resolution Preview: Event chance clamps to 10–95 after current Notoriety and carry modifiers. | PASS; planned: rules.E01.bounds; mapped: rules.E01.bounds, rules.E01.queued; service: none |
| E01.trigger / 4-events | Phase View / Resolution Preview: Roll below chance triggers; equal or above does not. | PASS; planned: rules.E01.trigger; mapped: rules.E01.trigger; service: none |
| E01.settlement / 4-events | Phase View / Resolution Preview: Operating settlement modifies table result by plus or minus 5 separately from chance. | PASS; planned: rules.E01.settlement; mapped: rules.E01.settlement; service: none |
| E01.recompute / 4-events | Phase View / Resolution Preview: Activity Notoriety and guarantees recompute chance and required inputs after upstream edits. | PASS; planned: rules.E01.recompute; mapped: rules.E01.recompute; service: none |

## E02

Sources: [T056: ## Table 6-3: Militia Events (d%)](../docs/ai/ironfang-militia/militia-tables.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| E02.intervals / 4-events | Phase View / Resolution Preview: Every Table 6-3 lower and upper endpoint maps to its specified event. | PASS; planned: rules.E02.intervals; mapped: rules.E02.interval-1-4, rules.E02.interval-5-12, rules.E02.interval-13-16, rules.E02.interval-17-20, rules.E02.interval-21-24, rules.E02.interval-25-28, rules.E02.interval-29-32, rules.E02.interval-33-36, rules.E02.interval-37-40, rules.E02.interval-41-44, rules.E02.interval-45-48, rules.E02.interval-49-52, rules.E02.interval-53-56, rules.E02.interval-57-60, rules.E02.interval-61-64, rules.E02.interval-65-68, rules.E02.interval-69-72, rules.E02.interval-73-76, rules.E02.interval-77-80, rules.E02.interval-81-84, rules.E02.interval-85-88, rules.E02.interval-89-96, rules.E02.interval-97-99, rules.E02.interval-100-100, rules.E02.integrity, rules.E02.parity, rules.GATE.projection-parity; service: none |
| E02.integrity / 4-events | Phase View / Resolution Preview: Missing, nonfinite, fractional or out-of-range percentile input is surfaced as invalid input or explicit rules departure as appropriate. | PASS; planned: rules.E02.integrity; mapped: rules.E02.integrity; service: none |
| E02.parity / 4-events | Phase View / Resolution Preview: Browser and Convex entry paths produce identical event mapping. | PASS; planned: rules.E02.parity; mapped: rules.E02.parity; service: none |
| E02.interval-1-4 / 4-events | Phase View / Resolution Preview: both endpoints of 1-4 resolve to Week of Serenity. | PASS; planned: rules.E02.interval-1-4; mapped: rules.E02.interval-1-4; service: none |
| E02.interval-5-12 / 4-events | Phase View / Resolution Preview: both endpoints of 5-12 resolve to War Games. | PASS; planned: rules.E02.interval-5-12; mapped: rules.E02.interval-5-12; service: none |
| E02.interval-13-16 / 4-events | Phase View / Resolution Preview: both endpoints of 13-16 resolve to Night Ops. | PASS; planned: rules.E02.interval-13-16; mapped: rules.E02.interval-13-16; service: none |
| E02.interval-17-20 / 4-events | Phase View / Resolution Preview: both endpoints of 17-20 resolve to Broke the Code. | PASS; planned: rules.E02.interval-17-20; mapped: rules.E02.interval-17-20; service: none |
| E02.interval-21-24 / 4-events | Phase View / Resolution Preview: both endpoints of 21-24 resolve to Found Fire. | PASS; planned: rules.E02.interval-21-24; mapped: rules.E02.interval-21-24; service: none |
| E02.interval-25-28 / 4-events | Phase View / Resolution Preview: both endpoints of 25-28 resolve to High Morale. | PASS; planned: rules.E02.interval-25-28; mapped: rules.E02.interval-25-28; service: none |
| E02.interval-29-32 / 4-events | Phase View / Resolution Preview: both endpoints of 29-32 resolve to Turn Around. | PASS; planned: rules.E02.interval-29-32; mapped: rules.E02.interval-29-32; service: none |
| E02.interval-33-36 / 4-events | Phase View / Resolution Preview: both endpoints of 33-36 resolve to Festival. | PASS; planned: rules.E02.interval-33-36; mapped: rules.E02.interval-33-36; service: none |
| E02.interval-37-40 / 4-events | Phase View / Resolution Preview: both endpoints of 37-40 resolve to Market Day. | PASS; planned: rules.E02.interval-37-40; mapped: rules.E02.interval-37-40; service: none |
| E02.interval-41-44 / 4-events | Phase View / Resolution Preview: both endpoints of 41-44 resolve to Hidden Agenda. | PASS; planned: rules.E02.interval-41-44; mapped: rules.E02.interval-41-44; service: none |
| E02.interval-45-48 / 4-events | Phase View / Resolution Preview: both endpoints of 45-48 resolve to All Is Calm. | PASS; planned: rules.E02.interval-45-48; mapped: rules.E02.interval-45-48; service: none |
| E02.interval-49-52 / 4-events | Phase View / Resolution Preview: both endpoints of 49-52 resolve to Roll Twice. | PASS; planned: rules.E02.interval-49-52; mapped: rules.E02.interval-49-52; service: none |
| E02.interval-53-56 / 4-events | Phase View / Resolution Preview: both endpoints of 53-56 resolve to Calm before the Storm. | PASS; planned: rules.E02.interval-53-56; mapped: rules.E02.interval-53-56; service: none |
| E02.interval-57-60 / 4-events | Phase View / Resolution Preview: both endpoints of 57-60 resolve to Turncoat. | PASS; planned: rules.E02.interval-57-60; mapped: rules.E02.interval-57-60; service: none |
| E02.interval-61-64 / 4-events | Phase View / Resolution Preview: both endpoints of 61-64 resolve to Cache Discovered. | PASS; planned: rules.E02.interval-61-64; mapped: rules.E02.interval-61-64; service: none |
| E02.interval-65-68 / 4-events | Phase View / Resolution Preview: both endpoints of 65-68 resolve to Rivalry. | PASS; planned: rules.E02.interval-65-68; mapped: rules.E02.interval-65-68; service: none |
| E02.interval-69-72 / 4-events | Phase View / Resolution Preview: both endpoints of 69-72 resolve to Missing in Action. | PASS; planned: rules.E02.interval-69-72; mapped: rules.E02.interval-69-72; service: none |
| E02.interval-73-76 / 4-events | Phase View / Resolution Preview: both endpoints of 73-76 resolve to Theft. | PASS; planned: rules.E02.interval-73-76; mapped: rules.E02.interval-73-76; service: none |
| E02.interval-77-80 / 4-events | Phase View / Resolution Preview: both endpoints of 77-80 resolve to Raid. | PASS; planned: rules.E02.interval-77-80; mapped: rules.E02.interval-77-80; service: none |
| E02.interval-81-84 / 4-events | Phase View / Resolution Preview: both endpoints of 81-84 resolve to Invasion. | PASS; planned: rules.E02.interval-81-84; mapped: rules.E02.interval-81-84; service: none |
| E02.interval-85-88 / 4-events | Phase View / Resolution Preview: both endpoints of 85-88 resolve to Low Morale. | PASS; planned: rules.E02.interval-85-88; mapped: rules.E02.interval-85-88; service: none |
| E02.interval-89-96 / 4-events | Phase View / Resolution Preview: both endpoints of 89-96 resolve to Sickness. | PASS; planned: rules.E02.interval-89-96; mapped: rules.E02.interval-89-96; service: none |
| E02.interval-97-99 / 4-events | Phase View / Resolution Preview: both endpoints of 97-99 resolve to Double Agent. | PASS; planned: rules.E02.interval-97-99; mapped: rules.E02.interval-97-99; service: none |
| E02.interval-100 / 4-events | Phase View / Resolution Preview: both endpoints of 100 resolve to Week of Pain. | PASS; planned: rules.E02.interval-100; mapped: rules.E02.interval-100-100; service: none |

## E03

Sources: [R460: ### Event Resolution Notes](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| E03.eligibility / 4-events | Phase View / Resolution Preview: Events with no eligible roster, cache, refuge or town require replacement rolls. | PASS; planned: rules.E03.eligibility; mapped: rules.P01.eligibility, rules.P77.projection-parity, rules.E03.eligibility, rules.E03.candidates; service: none |
| E03.targets / 4-events | Phase View / Resolution Preview: Inaccessible targets cannot silently stand in for eligible targets. | PASS; planned: rules.E03.targets; mapped: rules.E03.eligibility, rules.E03.nested, rules.EV13.inputs, rules.EV12.operation-scope, rules.EV12.settlement-exception, rules.E03.outcome-replacement, rules.GATE.projection-parity; service: none |
| E03.nested / 4-events | Phase View / Resolution Preview: Replacement rolls remain required after nested Roll Twice until valid outcomes exist. | PASS; planned: rules.E03.nested; mapped: rules.E03.nested; service: none |

## E04

Sources: [R556: ## Event: Roll Twice](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| E04.two / 4-events | Phase View / Resolution Preview: Roll Twice resolves two independent final occurrences. | PASS; planned: rules.E04.two; mapped: rules.E04.two; service: none |
| E04.reroll / 4-events | Phase View / Resolution Preview: Further Roll Twice results require replacement rolls rather than disappearing. | PASS; planned: rules.E04.reroll; mapped: rules.E04.reroll; service: none |
| E04.no-clause / 4-events | Phase View / Resolution Preview: Duplicate without Twice applies both base occurrences independently. | PASS; planned: rules.E04.no-clause; mapped: rules.E04.no-clause; service: none |
| E04.clause / 4-events | Phase View / Resolution Preview: Explicit Twice replacement or enhancement controls duplicate effect; no-additional-effect suppresses the extra effect. | PASS; planned: rules.E04.clause; mapped: rules.E04.clause; service: none |
| E04.independent / 4-events | Phase View / Resolution Preview: Guarantee and automatic events retain separate target and roll identities in order. | PASS; planned: rules.E04.independent; mapped: rules.E04.independent; service: none |

## E05

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R081: ### Event Chance](../docs/ai/ironfang-militia/militia-rules.md); [R452: ### Event Trigger](../docs/ai/ironfang-militia/militia-rules.md); [R468: ## Event: All Is Calm](../docs/ai/ironfang-militia/militia-rules.md); [R485: ## Event: Calm before the Storm](../docs/ai/ironfang-militia/militia-rules.md); [T056: ## Table 6-3: Militia Events (d%)](../docs/ai/ironfang-militia/militia-tables.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| E05.context-carry / 3-context | Preparation retains uneventful carry, one-use bonuses and queued durations without executing effects. | PASS; planned: context.events-assets, context.shared; mapped: context.events-assets, context.shared; service: none |
| E05.carry / 4-events | Phase View / Resolution Preview: Eligible quiet week adds current rank once to next eligible week's bounded event chance, not percentile result. | PASS; planned: rules.E05.carry; mapped: rules.E05.carry; service: none |
| E05.consecutive / 4-events | Phase View / Resolution Preview: Consecutive quiet weeks do not accumulate prior rank bonuses. | PASS; planned: rules.E05.consecutive; mapped: rules.E05.consecutive; service: none |
| E05.rank-change / 4-events | Phase View / Resolution Preview: Changing rank uses current rank rather than stored old-rank sum. | PASS; planned: rules.E05.rank-change; mapped: rules.E05.rank-change; service: none |
| E05.exclusions / 4-events | Phase View / Resolution Preview: First militia week, forced All Is Calm, Calm before the Storm and automatic events obey uneventful exclusions. | PASS; planned: rules.E05.exclusions; mapped: rules.E05.exclusions, rules.E05.double-calm; service: none |

## E06

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R088: ### Active and Persistent Events](../docs/ai/ironfang-militia/militia-rules.md); [R450: ## Event Phase](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| E06.due / 4-events | Phase View / Resolution Preview: Only due-week queued effects apply; future effects remain and consumed effects expire. | PASS; planned: rules.E06.due; mapped: rules.E01.queued, rules.E88.complete, rules.GATE.projection-parity; service: none |
| E06.automatic / 4-events | Phase View / Resolution Preview: Multiple automatic events and normal event keep separate rolls and source order. | PASS; planned: rules.E06.automatic; mapped: rules.E04.independent, rules.EV04.twice, rules.E88.complete, rules.GATE.projection-parity; service: none |
| E06.preserve / 4-events | Phase View / Resolution Preview: Cutover preserves source, age and due context without running effects. | PASS; planned: rules.E06.preserve; mapped: context.events-assets, rules.E88.complete, rules.GATE.projection-parity; service: live.cutover |
| E06.retry / 4-events | Phase View / Resolution Preview: Retries do not apply queued effects twice. | PASS; planned: rules.E06.retry; mapped: rules.E88.complete, rules.P80.atomic, rules.GATE.projection-parity; service: none |

## E07

Sources: [R137: ### Overseer](../docs/ai/ironfang-militia/militia-rules.md); [R149: ### Strategist](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| E07.phase / 4-events | Phase View / Resolution Preview: Each queued modifier applies only to its prescribed phase and check type. | PASS; planned: rules.E07.phase; mapped: rules.E07.phase, rules.EV23.expiry, rules.GATE.projection-parity; service: none |
| E07.once / 4-events | Phase View / Resolution Preview: Officer, manager and queue modifiers compose once with positive and negative values. | PASS; planned: rules.E07.once; mapped: rules.F03.composition, rules.A18.composition, rules.A18.carried, rules.E07.phase, rules.GATE.projection-parity; service: none |
| E07.one-check / 4-events | Phase View / Resolution Preview: Team one-check bonus is consumed by one eligible check. | PASS; planned: rules.E07.one-check; mapped: rules.EV20.none, rules.P78.consumables, rules.P78.consumable-targets, rules.GATE.projection-parity; service: none |
| E07.stale / 4-events | Phase View / Resolution Preview: Disabled or deselected secondary inputs cannot contribute hidden modifiers. | PASS; planned: rules.E07.stale; mapped: rules.E07.stale, rules.A18.failure, rules.A18.composition, rules.GATE.projection-parity; service: none |

## EV01

Sources: [R468: ## Event: All Is Calm](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV01.base / 4-events | Phase View / Resolution Preview: All Is Calm produces no event. | PASS; planned: rules.EV01.base; mapped: rules.EV01.base, rules.E74.projection-parity; service: none |
| EV01.twice / 4-events | Phase View / Resolution Preview: Twice forces the same result next week without chance roll or uneventful carry chain. | PASS; planned: rules.EV01.twice; mapped: rules.EV24.twice, rules.E76.projection-parity, rules.EV23.twice, rules.EV21.twice, rules.E75.projection-parity, rules.EV18.twice, rules.EV16.twice, rules.EV16.check, rules.EV14.twice, rules.E74.projection-parity, rules.EV13.twice, rules.EV12.twice, rules.EV11.twice, rules.EV09.twice, rules.EV08.twice, rules.EV07.twice, rules.EV06.twice, rules.EV04.twice, rules.EV03.twice, rules.EV02.twice, rules.EV01.twice; service: none |
| EV01.precedence / 4-events | Phase View / Resolution Preview: Automatic Calm before the Storm events remain independently accounted for; stale trigger and Sabotage inputs do not execute. | PASS; planned: rules.EV01.precedence; mapped: rules.EV01.precedence, rules.E74.projection-parity; service: none |

## EV02

Sources: [R473: ## Event: Broke the Code](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV02.base / 4-events | Phase View / Resolution Preview: Identify one item of any caster level and give +2 Knowledge local for one week. | PASS; planned: rules.EV02.base; mapped: rules.EV02.base, rules.E74.projection-parity; service: none |
| EV02.twice / 4-events | Phase View / Resolution Preview: Twice replaces bonus with +5 rather than adding duplicate notes. | PASS; planned: rules.EV02.twice; mapped: rules.EV02.twice, rules.E74.projection-parity; service: none |
| EV02.acknowledgement / 4-events | Phase View / Resolution Preview: Item identification requires retained acknowledgement and expires at prescribed time. | PASS; planned: rules.EV02.acknowledgement; mapped: rules.EV02.acknowledgement, rules.E74.projection-parity; service: none |

## EV03

Sources: [R479: ## Event: Cache Discovered](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV03.base / 4-events | Phase View / Resolution Preview: Lose one selected hidden or planned cache unless Secrecy DC10 plus rank retrieves it. | PASS; planned: rules.EV03.base; mapped: rules.EV03.loss, rules.EV03.inputs, rules.E75.projection-parity; service: none |
| EV03.twice / 4-events | Phase View / Resolution Preview: Twice threatens all applicable caches with explicit mitigation scope. | PASS; planned: rules.EV03.twice; mapped: rules.EV03.twice, rules.E75.projection-parity; service: none |
| EV03.empty / 4-events | Phase View / Resolution Preview: No eligible caches requires reroll. | PASS; planned: rules.EV03.empty; mapped: rules.EV20.empty, rules.E74.projection-parity, rules.EV15.empty, rules.E75.projection-parity, rules.EV13.empty, rules.EV03.empty; service: none |
| EV03.multiple / 4-events | Phase View / Resolution Preview: Two or more caches retain distinct loss and recovery outcomes and modifier-aware checks. | PASS; planned: rules.EV03.multiple; mapped: rules.EV03.mitigate, rules.EV03.modifiers, rules.E75.projection-parity; service: none |

## EV04

Sources: [R485: ## Event: Calm before the Storm](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV04.base / 4-events | Phase View / Resolution Preview: No event now; next week one automatic table event precedes normal Event processing. | PASS; planned: rules.EV04.base; mapped: rules.EV04.base, rules.E76.projection-parity; service: none |
| EV04.twice / 4-events | Phase View / Resolution Preview: Twice queues two automatic events, not three. | PASS; planned: rules.EV04.twice; mapped: rules.EV04.twice, rules.E76.projection-parity; service: none |
| EV04.reroll / 4-events | Phase View / Resolution Preview: Automatic Roll Twice results require replacement without suppressing independent normal rolls. | PASS; planned: rules.EV04.reroll; mapped: rules.EV04.replacement, rules.E76.projection-parity; service: none |
| EV04.order / 4-events | Phase View / Resolution Preview: Order-sensitive outcomes use independent rolls and do not create uneventful carry. | PASS; planned: rules.EV04.order; mapped: rules.P07.order, rules.EV20.order, rules.E74.projection-parity, rules.EV19.base, rules.E76.projection-parity, rules.EV04.twice; service: none |

## EV05

Sources: [R492: ## Event: Double Agent (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV05.base / 4-events | Phase View / Resolution Preview: Nonpersistent Double Agent blocks only next Activity Secure Cache and applies one -2 Secrecy penalty. | PASS; planned: rules.EV05.base; mapped: rules.EV05.base, rules.E76.projection-parity; service: none |
| EV05.persistent / 4-events | Phase View / Resolution Preview: Twice keeps the restriction and single -2 penalty across all affected weeks. | PASS; planned: rules.EV05.persistent; mapped: rules.EV19.twice, rules.EV19.ending, rules.E76.projection-parity, rules.EV05.twice, rules.EV05.single-penalty; service: none |
| EV05.end / 4-events | Phase View / Resolution Preview: Ending or buyoff removes future restriction and penalty. | PASS; planned: rules.EV05.end; mapped: rules.EV05.exception, rules.E88.complete, rules.GATE.projection-parity; service: none |
| EV05.exception / 4-events | Phase View / Resolution Preview: Staged cache action remains visible with warning and reasoned exception path. | PASS; planned: rules.EV05.exception; mapped: rules.EV05.exception, rules.GATE.projection-parity; service: none |

## EV06

Sources: [R498: ## Event: Festival](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV06.base / 4-events | Phase View / Resolution Preview: Chosen recently used town grants +2 morale Bluff, Diplomacy and Intimidate for a week. | PASS; planned: rules.EV06.base; mapped: rules.EV06.base, rules.E74.projection-parity; service: none |
| EV06.twice / 4-events | Phase View / Resolution Preview: Twice replaces bonus with +5. | PASS; planned: rules.EV06.twice; mapped: rules.EV06.twice, rules.E74.projection-parity; service: none |
| EV06.record / 4-events | Phase View / Resolution Preview: Town selection, duration and acknowledgement are recorded. | PASS; planned: rules.EV06.record; mapped: rules.EV14.record, rules.E74.projection-parity, rules.EV07.record, rules.EV06.record, rules.EV06.operation-scope, rules.EV12.settlement-exception; service: none |

## EV07

Sources: [R504: ## Event: Found Fire](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV07.base / 4-events | Phase View / Resolution Preview: Each PC receives one nonpoison alchemical item worth at most 100 gp and next-week Security +2. | PASS; planned: rules.EV07.base; mapped: rules.EV07.base, rules.E74.projection-parity; service: none |
| EV07.twice / 4-events | Phase View / Resolution Preview: Twice gives two items per PC total but Security remains +2. | PASS; planned: rules.EV07.twice; mapped: rules.EV07.twice, rules.E74.projection-parity; service: none |
| EV07.record / 4-events | Phase View / Resolution Preview: PC eligibility, item limits and acknowledgement persist; duration expires. | PASS; planned: rules.EV07.record; mapped: rules.EV07.record, rules.E74.projection-parity; service: none |

## EV08

Sources: [R510: ## Event: Hidden Agenda](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV08.base / 4-events | Phase View / Resolution Preview: All current Activity checks receive +2. | PASS; planned: rules.EV08.base; mapped: rules.EV08.base, rules.E76.projection-parity; service: none |
| EV08.twice / 4-events | Phase View / Resolution Preview: Twice replaces with +5 rather than adding +7. | PASS; planned: rules.EV08.twice; mapped: rules.EV08.twice, rules.E76.projection-parity; service: none |
| EV08.recompute / 4-events | Phase View / Resolution Preview: All Activity actions recalculate their checks and resulting outcomes when Hidden Agenda is added, changed, or removed, with browser/server agreement. Its bonus applies to every Activity check, not only Drill Militia and Earn Gold. | PASS; planned: rules.EV08.recompute; mapped: rules.EV08.actions.dismiss_team, rules.EV08.actions.drill_militia, rules.EV08.actions.recruit_team, rules.EV08.actions.earn_gold, rules.EV08.actions.gather_information, rules.EV08.actions.knowledge_check, rules.EV08.actions.rescue_character, rules.EV08.actions.reduce_danger, rules.EV08.actions.spread_propaganda, rules.EV08.actions.activate_black_market, rules.EV08.actions.secure_cache, rules.EV08.no-check, rules.EV08.twice, rules.EV08.readiness, rules.E76.projection-parity; service: none |

## EV09

Sources: [R515: ## Event: High Morale](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV09.base / 4-events | Phase View / Resolution Preview: End one persistent event immediately and give upcoming Loyalty +2. | PASS; planned: rules.EV09.base; mapped: rules.EV09.base, rules.E76.projection-parity; service: none |
| EV09.twice / 4-events | Phase View / Resolution Preview: Actual duplicate pair ends two total and gives +5, not three and +7. | PASS; planned: rules.EV09.twice; mapped: rules.EV09.twice, rules.E76.projection-parity; service: none |
| EV09.targets / 4-events | Phase View / Resolution Preview: Zero to three active events, age ties and new same-week persistence retain explicit selected endings. | PASS; planned: rules.EV09.targets; mapped: rules.EV09.empty, rules.E76.projection-parity; service: none |
| EV09.recompute / 4-events | Phase View / Resolution Preview: Ended event modifiers are removed from dependent checks. | PASS; planned: rules.EV09.recompute; mapped: rules.EV09.recompute, rules.E88.complete, rules.GATE.projection-parity; service: none |

## EV10

Sources: [R521: ## Event: Invasion](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV10.encounter / 4-events | Phase View / Resolution Preview: Show and record GM random encounter at APL plus 1 CR. | PASS; planned: rules.EV10.encounter; mapped: rules.EV10.base, rules.E75.projection-parity; service: none |
| EV10.acknowledgement / 4-events | Phase View / Resolution Preview: Required encounter acknowledgement is retained. | PASS; planned: rules.EV10.acknowledgement; mapped: rules.EV10.inputs, rules.E75.projection-parity; service: none |
| EV10.duplicate / 4-events | Phase View / Resolution Preview: No Twice clause means two independent encounters. | PASS; planned: rules.EV10.duplicate; mapped: rules.EV22.duplicate, rules.E74.projection-parity, rules.EV10.duplicate, rules.E75.projection-parity; service: none |

## EV11

Sources: [R525: ## Event: Low Morale (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV11.base / 4-events | Phase View / Resolution Preview: Loyalty -2 applies for the prescribed week. | PASS; planned: rules.EV11.base; mapped: rules.EV11.base, rules.E76.projection-parity; service: none |
| EV11.twice / 4-events | Phase View / Resolution Preview: Twice makes one persistent -2 effect, not doubled penalties. | PASS; planned: rules.EV11.twice; mapped: rules.EV11.twice, rules.E76.projection-parity; service: none |
| EV11.duration / 4-events | Phase View / Resolution Preview: First and later weeks affect relevant Loyalty checks until ending. | PASS; planned: rules.EV11.duration; mapped: rules.EV11.duration, rules.EV11.base, rules.EV11.twice, rules.GATE.projection-parity; service: none |

## EV12

Sources: [R530: ## Event: Market Day](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV12.base / 4-events | Phase View / Resolution Preview: Chosen operated town gives extra 5% discount on all items and services. | PASS; planned: rules.EV12.base; mapped: rules.EV12.base, rules.E74.projection-parity; service: none |
| EV12.twice / 4-events | Phase View / Resolution Preview: Twice covers all operated marketplaces including Broker Market. | PASS; planned: rules.EV12.twice; mapped: rules.EV12.twice, rules.E74.projection-parity; service: none |
| EV12.composition / 4-events | Phase View / Resolution Preview: Reputation discounts compose and town services are not limited to tracked market rows. | PASS; planned: rules.EV12.composition; mapped: rules.EV12.composition, rules.E74.projection-parity; service: none |
| EV12.inputs / 4-events | Phase View / Resolution Preview: Market Day can be rolled and retained even when no town or settlement exists yet. A valid settlement must be chosen before the event can resolve; its discount expires at the prescribed time. | PASS; planned: rules.EV12.inputs; mapped: rules.EV12.unselected-town, rules.EV21.inputs, rules.E75.projection-parity, rules.EV12.inputs, rules.EV12.operation-scope, rules.EV12.settlement-exception, rules.E74.projection-parity; service: none |

## EV13

Sources: [R535: ## Event: Missing in Action](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV13.base / 4-events | Phase View / Resolution Preview: Random team that operated this week is unavailable next week. | PASS; planned: rules.EV13.base; mapped: rules.EV13.base, rules.EV13.inputs, rules.E75.projection-parity; service: none |
| EV13.twice / 4-events | Phase View / Resolution Preview: Twice returns it at end of following week disabled, with no early DC15 recovery. | PASS; planned: rules.EV13.twice; mapped: rules.EV13.twice, rules.E75.projection-parity; service: none |
| EV13.empty / 4-events | Phase View / Resolution Preview: No operated eligible team requires reroll. | PASS; planned: rules.EV13.empty; mapped: rules.EV13.empty, rules.E75.projection-parity; service: none |
| EV13.timeline / 4-events | Phase View / Resolution Preview: Disabled recovery cost is considered next Upkeep, using fresh team condition state. | PASS; planned: rules.EV13.timeline; mapped: rules.EV13.no-early-return, rules.EV13.new-absence, rules.EV13.twice, rules.E75.projection-parity; service: none |

## EV14

Sources: [R540: ## Event: Night Ops](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV14.base / 4-events | Phase View / Resolution Preview: One-week +2 circumstance Stealth applies after dark. | PASS; planned: rules.EV14.base; mapped: rules.EV14.base, rules.E74.projection-parity; service: none |
| EV14.twice / 4-events | Phase View / Resolution Preview: Twice gives effective +5 rather than +7. | PASS; planned: rules.EV14.twice; mapped: rules.EV14.twice, rules.E74.projection-parity; service: none |
| EV14.record / 4-events | Phase View / Resolution Preview: Darkness condition, bonus type, expiry and acknowledgement remain explicit. | PASS; planned: rules.EV14.record; mapped: rules.EV14.record, rules.E74.projection-parity; service: none |

## EV15

Sources: [R545: ## Event: Raid](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV15.settlement / 4-events | Phase View / Resolution Preview: Random selected settlement loses all its refuges; other settlements remain unaffected. | PASS; planned: rules.EV15.settlement; mapped: rules.EV15.base, rules.EV15.references, rules.E75.projection-parity; service: none |
| EV15.capture / 4-events | Phase View / Resolution Preview: Each hidden person has separate capture chance and Security DC20 halves that chance. | PASS; planned: rules.EV15.capture; mapped: rules.EV15.mitigate, rules.EV15.inputs, rules.E75.projection-parity; service: none |
| EV15.empty / 4-events | Phase View / Resolution Preview: No refuge requires reroll. | PASS; planned: rules.EV15.empty; mapped: rules.EV15.empty, rules.E75.projection-parity; service: none |
| EV15.rescue / 4-events | Phase View / Resolution Preview: Captured persons retain next-week rescue DC5 plus rank and valid access context. | PASS; planned: rules.EV15.rescue; mapped: rules.EV15.rescue, rules.E75.projection-parity; service: none |

## EV16

Sources: [R551: ## Event: Rivalry (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV16.targets / 4-events | Phase View / Resolution Preview: Two distinct randomly selected teams cannot act next Activity; selected identities persist. | PASS; planned: rules.EV16.targets; mapped: rules.EV16.base, rules.EV16.inputs, rules.E76.projection-parity; service: none |
| EV16.twice / 4-events | Phase View / Resolution Preview: Twice persists across weeks until officer Bluff, Diplomacy or Intimidate reaches DC20. | PASS; planned: rules.EV16.twice; mapped: rules.EV16.twice, rules.EV16.check, rules.E76.projection-parity; service: none |
| EV16.boundary / 4-events | Phase View / Resolution Preview: Each of the three skills fails at 19 and ends at 20. | PASS; planned: rules.EV16.boundary; mapped: rules.P02.rivalry.bluff, rules.P02.rivalry.diplomacy, rules.P02.rivalry.intimidate, rules.EV16.check, rules.GATE.projection-parity; service: none |
| EV16.empty / 4-events | Phase View / Resolution Preview: Insufficient eligible teams requires reroll; ending releases both targets. | PASS; planned: rules.EV16.empty; mapped: rules.E03.eligibility, rules.P02.rivalry.bluff, rules.P02.rivalry.diplomacy, rules.P02.rivalry.intimidate, rules.GATE.projection-parity; service: none |

## EV17

Sources: [R556: ## Event: Roll Twice](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV17.expansion / 4-events | Phase View / Resolution Preview: Roll Twice produces two valid outcomes with each event's own Twice policy. | PASS; planned: rules.EV17.expansion; mapped: rules.E04.two, rules.E04.no-clause, rules.E04.clause, rules.E88.complete, rules.GATE.projection-parity; service: none |
| EV17.reroll / 4-events | Phase View / Resolution Preview: Repeated Roll Twice outcomes are rerolled. | PASS; planned: rules.EV17.reroll; mapped: rules.E04.reroll, rules.E03.nested, rules.EV04.replacement, rules.GATE.projection-parity; service: none |
| EV17.namespace / 4-events | Phase View / Resolution Preview: Normal and automatic events retain independent occurrence identities. | PASS; planned: rules.EV17.namespace; mapped: rules.E04.independent, rules.EV04.twice, rules.EV04.replacement, rules.E88.complete, rules.GATE.projection-parity; service: none |

## EV18

Sources: [R562: ## Event: Sickness](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV18.base / 4-events | Phase View / Resolution Preview: Random eligible team becomes disabled. | PASS; planned: rules.EV18.base; mapped: rules.EV18.base, rules.E75.projection-parity; service: none |
| EV18.twice / 4-events | Phase View / Resolution Preview: Twice loses it unless modified Loyalty reaches DC20. | PASS; planned: rules.EV18.twice; mapped: rules.EV18.twice, rules.E75.projection-parity; service: none |
| EV18.readiness / 4-events | Phase View / Resolution Preview: Missing mitigation input prevents an attempted mitigation from becoming an irreversible implicit failure. | PASS; planned: rules.EV18.readiness; mapped: rules.EV18.inputs, rules.E75.projection-parity; service: none |
| EV18.ordering / 4-events | Phase View / Resolution Preview: Empty roster rerolls; preceding events update eligibility before selection. | PASS; planned: rules.EV18.ordering; mapped: rules.EV18.ordering, rules.E03.outcome-replacement, rules.E03.replacement-sabotage, rules.E03.replacement-duplicates, rules.E75.projection-parity; service: none |

## EV19

Sources: [R567: ## Event: Theft (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV19.activity-income / 4-activity | Activity earnings and sales retain half their copper-rounded gain under carried Theft; expenses remain full and end IDs restore later income. | PASS; planned: rules.economy.theft-income, rules.economy.theft-order, rules.economy.theft-ending; mapped: rules.economy.theft-income, rules.economy.theft-order, rules.economy.theft-ending, rules.A06.projection-parity; service: none |
| EV19.base / 4-events | Phase View / Resolution Preview: Theft takes half of treasury after prior costs, rounded to copper precision. | PASS; planned: rules.EV19.base; mapped: rules.EV19.base, rules.E76.projection-parity; service: none |
| EV19.mitigation / 4-events | Phase View / Resolution Preview: Loyalty DC20 reduces current loss to 10%; mitigation lasts only one week. | PASS; planned: rules.EV19.mitigation; mapped: rules.EV19.mitigate, rules.E76.projection-parity; service: none |
| EV19.persistent / 4-events | Phase View / Resolution Preview: Twice halves incoming gains until successful Reduce Danger ends it. | PASS; planned: rules.EV19.persistent; mapped: rules.EV19.twice, rules.EV19.ending, rules.E76.projection-parity; service: none |
| EV19.order / 4-events | Phase View / Resolution Preview: Ordinary Theft causes a one-time treasury loss when the event resolves. Only persistent Theft from the Twice result reduces subsequent incoming money; gains before it ends are reduced, and gains after it ends are received in full. | PASS; planned: rules.EV19.order; mapped: rules.EV19.base, rules.E76.projection-parity; service: none |

## EV20

Sources: [R573: ## Event: Turn Around](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV20.disabled / 4-events | Phase View / Resolution Preview: All disabled teams recover. | PASS; planned: rules.EV20.disabled; mapped: rules.EV20.disabled, rules.E74.projection-parity; service: none |
| EV20.none / 4-events | Phase View / Resolution Preview: If none disabled, select one team for +2 on exactly one next-Activity check. | PASS; planned: rules.EV20.none; mapped: rules.EV20.none, rules.E74.projection-parity; service: none |
| EV20.empty / 4-events | Phase View / Resolution Preview: No team follows event eligibility reroll policy. | PASS; planned: rules.EV20.empty; mapped: rules.EV20.empty, rules.E74.projection-parity; service: none |
| EV20.order / 4-events | Phase View / Resolution Preview: Successive events and expiring returns use current projected state; unused bonus expires. | PASS; planned: rules.EV20.order; mapped: rules.EV20.order, rules.E74.projection-parity; service: none |

## EV21

Sources: [R578: ## Event: Turncoat](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV21.base / 4-events | Phase View / Resolution Preview: Training loses rolled 1d6 plus current rank. | PASS; planned: rules.EV21.base; mapped: rules.EV21.base, rules.E75.projection-parity; service: none |
| EV21.twice / 4-events | Phase View / Resolution Preview: GM-chosen team defects unless Diplomacy reaches DC10 plus rank. | PASS; planned: rules.EV21.twice; mapped: rules.EV21.twice, rules.E75.projection-parity; service: none |
| EV21.success / 4-events | Phase View / Resolution Preview: Successful prevention still leaves team unavailable next Activity. | PASS; planned: rules.EV21.success; mapped: rules.EV21.twice, rules.E75.projection-parity; service: none |
| EV21.inputs / 4-events | Phase View / Resolution Preview: Missing die, team or attempted check prevents readiness and modifiers apply once. | PASS; planned: rules.EV21.inputs; mapped: rules.EV21.inputs, rules.E75.projection-parity; service: none |

## EV22

Sources: [R583: ## Event: War Games](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV22.base / 4-events | Phase View / Resolution Preview: Training increases by current post-Upkeep rank. | PASS; planned: rules.EV22.base; mapped: rules.EV22.base, rules.E74.projection-parity; service: none |
| EV22.duplicate / 4-events | Phase View / Resolution Preview: No Twice clause means duplicate grants rank twice. | PASS; planned: rules.EV22.duplicate; mapped: rules.EV22.duplicate, rules.E74.projection-parity; service: none |
| EV22.timing / 4-events | Phase View / Resolution Preview: Event training gain does not retroactively run Upkeep rank advancement. | PASS; planned: rules.EV22.timing; mapped: rules.EV22.timing, rules.E74.projection-parity; service: none |

## EV23

Sources: [R587: ## Event: Week of Pain](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV23.checks / 4-events | Phase View / Resolution Preview: Next week all organization checks take -1 across all phases. | PASS; planned: rules.EV23.checks; mapped: rules.EV23.base, rules.E76.projection-parity; service: none |
| EV23.losses / 4-events | Phase View / Resolution Preview: Next Upkeep doubles all training losses but not natural-20 gains. | PASS; planned: rules.EV23.losses; mapped: rules.EV23.twice, rules.E76.projection-parity; service: none |
| EV23.twice / 4-events | Phase View / Resolution Preview: Duplicate adds no extra effect. | PASS; planned: rules.EV23.twice; mapped: rules.EV23.twice, rules.E76.projection-parity; service: none |
| EV23.expiry / 4-events | Phase View / Resolution Preview: Effects expire after next week and retain correct composition with Serenity. | PASS; planned: rules.EV23.expiry; mapped: rules.EV23.serenity-composition, rules.EV24.twice, rules.E76.projection-parity, rules.EV23.expiry, rules.EV23.twice, rules.GATE.projection-parity; service: none |

## EV24

Sources: [R593: ## Event: Week of Serenity](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| EV24.checks / 4-events | Phase View / Resolution Preview: Next week all organization checks receive +5. | PASS; planned: rules.EV24.checks; mapped: rules.EV24.twice, rules.E76.projection-parity; service: none |
| EV24.gains / 4-events | Phase View / Resolution Preview: Next Activity training gain includes Commandants once and then doubles. | PASS; planned: rules.EV24.gains; mapped: rules.EV24.base, rules.E76.projection-parity; service: none |
| EV24.twice / 4-events | Phase View / Resolution Preview: Duplicate adds no extra effect. | PASS; planned: rules.EV24.twice; mapped: rules.EV24.twice, rules.E76.projection-parity; service: none |
| EV24.expiry / 4-events | Phase View / Resolution Preview: Effects last only next week and compose with Week of Pain without hidden duplication. | PASS; planned: rules.EV24.expiry; mapped: rules.EV24.twice, rules.E76.projection-parity; service: none |

## P01

Sources: [R019: ## Militia Terminology](../docs/ai/ironfang-militia/militia-rules.md); [R088: ### Active and Persistent Events](../docs/ai/ironfang-militia/militia-rules.md); [R460: ### Event Resolution Notes](../docs/ai/ironfang-militia/militia-rules.md); [R599: ## Persistent Events Rules](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P01.oldest / 4-persistence | Phase View / Resolution Preview: Persistent instances process oldest first with stable order for age ties. | PASS; planned: rules.P01.oldest; mapped: rules.P01.oldest, rules.P77.projection-parity; service: none |
| P01.identity / 4-persistence | Phase View / Resolution Preview: Multiple instances of the same type retain separate targets and ages. | PASS; planned: rules.P01.identity; mapped: rules.P01.identity, rules.P77.projection-parity; service: none |
| P01.eligibility / 4-persistence | Phase View / Resolution Preview: New same-week persistence does not change fixed carried-event phase eligibility. | PASS; planned: rules.P01.eligibility; mapped: rules.P01.eligibility, rules.P77.projection-parity; service: none |

## P02

Sources: [R599: ## Persistent Events Rules](../docs/ai/ironfang-militia/militia-rules.md); [R551: ## Event: Rivalry (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md); [R567: ## Event: Theft (Persistent-capable)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P02.weekly / 4-persistence | Phase View / Resolution Preview: Each persistent instance can attempt mitigation each week; last week's mitigation does not carry. | PASS; planned: rules.P02.weekly; mapped: rules.P02.weekly, rules.P02.successor, rules.P77.projection-parity; service: none |
| P02.optional / 4-persistence | Phase View / Resolution Preview: Unattempted optional mitigation differs from attempted incomplete mitigation. | PASS; planned: rules.P02.optional; mapped: rules.P02.optional, rules.P77.projection-parity; service: none |
| P02.end / 4-persistence | Phase View / Resolution Preview: Rivalry skill success and Theft Reduce Danger permanently end their target rather than temporary mitigation. | PASS; planned: rules.P02.end; mapped: rules.P02.rivalry.bluff, rules.P02.rivalry.diplomacy, rules.P02.rivalry.intimidate, rules.EV19.ending, rules.P77.rivalry-mutation, rules.P77.projection-parity; service: none |

## P03

Sources: [R599: ## Persistent Events Rules](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P03.context-persistent / 3-context | Preparation retains same-type event instances with separate targets, age/order, mitigation, ending and militia-wide last buyoff week. | PASS; planned: context.events-assets, context.references; mapped: context.events-assets, context.references; service: none |
| P03.first / 4-persistence | Phase View / Resolution Preview: First buyoff is immediately available even before week 4. | PASS; planned: rules.P03.first; mapped: rules.P03.first, rules.P77.projection-parity; service: none |
| P03.cooldown / 4-persistence | Phase View / Resolution Preview: Buyoff in week 2 blocks week 5 and permits week 6 across all persistent event targets. | PASS; planned: rules.P03.cooldown; mapped: rules.P03.cooldown.5, rules.P03.cooldown.6, rules.P77.projection-parity; service: none |
| P03.cost / 4-persistence | Phase View / Resolution Preview: Cost is twice current minimum treasury and insufficient funds use warning/exception policy. | PASS; planned: rules.P03.cost; mapped: rules.P03.cost, rules.P77.projection-parity; service: none |
| P03.stage / 4-persistence | Phase View / Resolution Preview: Buyoff remains staged until exact Confirmation and competing player edits cannot double-spend. | PASS; planned: rules.P03.stage; mapped: rules.P03.first, rules.P84.decisions, rules.E88.complete, rules.P80.atomic, rules.GATE.projection-parity, rules.P79.contract, rules.P80.contract; service: none |

## P04

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P04.summary-confirmation / 7-workspace | Summary exposes complete baseline and final outcomes with ordered reasoned adjudication; rejected saves and Confirmation require explicit fresh review before another attempt. | PASS; planned: rules.P85.summary, rules.P85.readiness, rules.P85.outcomes, rules.P85.event-identity, rules.P85.adjustment, rules.P85.order, rules.P85.exception, rules.P85.review, rules.P85.rereview, rules.P85.failed-save; mapped: rules.P85.summary, rules.P85.readiness, rules.P85.outcomes, rules.P85.event-identity, rules.P85.adjustment, rules.P85.order, rules.P85.exception, rules.P85.review, rules.P85.rereview, rules.P85.failed-save; service: none |
| P04.persistent-preparation / 7-workspace | Carried event instances retain fixed navigation eligibility, named targets and age/order while mitigation, officer ending, reasoned ending and buyoff remain shared staged decisions; buyoffs share the projected cooldown. | PASS; planned: rules.P84.workspace, rules.P84.decisions, rules.P84.ending, rules.P84.officer, rules.P84.copper, rules.P81.eligibility; mapped: rules.P84.workspace, rules.P84.decisions, rules.P84.ending, rules.P84.officer, rules.P84.copper, rules.P81.eligibility; service: none |
| P04.event-preparation / 7-workspace | Event occurrences expose independent branches, typed raw inputs, explicit clears, reactive decisions and owner-bound narrative outcomes through Workspace; disjoint occurrence edits coexist and stale edits recover visibly. | PASS; planned: rules.P83.workspace, rules.P83.input, rules.P83.acknowledgement, rules.P83.details, rules.P83.ownership, rules.P83.candidates, rules.P83.modifiers, rules.P79.contract; mapped: rules.P83.workspace, rules.P83.input, rules.P83.acknowledgement, rules.P83.details, rules.P83.ownership, rules.P83.candidates, rules.P83.modifiers, rules.P79.contract; service: none |
| P04.activity-cards / 7-workspace | Activity exposes complete shared choices, retains extra slots and supports accessible placement and nested typed details with precise copper input. | PASS; planned: rules.P82.workspace, rules.P82.cards, rules.P82.nested, rules.P82.union, rules.P82.decimal, rules.P82.references, rules.P82.validation, rules.P82.candidate-owner, rules.P82.warnings, rules.P82.receipt, rules.P82.modifiers, rules.P82.sources, rules.P82.nested-acknowledgements, rules.P82.declared-references, rules.P82.provenance; mapped: rules.P82.workspace, rules.P82.cards, rules.P82.nested; service: none |
| P04.states / 7-workspace | Only ready Workspace states expose semantic operations; unavailable/loading/failed recover when a valid source becomes available. | PASS; planned: rules.P81.states; mapped: rules.P81.states; service: none |
| P04.upkeep-input / 7-workspace | Upkeep raw input preserves zero versus clear, rejects invalid text without mutation, and displays deterministic bonuses and field-level required/format errors. | PASS; planned: rules.P81.digits, rules.P81.workspace; mapped: rules.P81.digits, rules.P81.workspace; service: none |
| P04.upkeep-card-placement / 7-workspace | Pointer placement highlights a selection target and stages one choice; invalid or cancelled drops return the card without changing selection, and tap/keyboard activation remain available. | PASS; planned: rules.P81.card-drag, rules.P81.card-return; mapped: rules.P81.card-drag, rules.P81.card-return; service: none |
| P04.upkeep-recovery-adjustment / 7-workspace | Recovery cards default to the deterministic cost; a reasoned override atomically stages the team decision and an ordered treasury adjustment after the unchanged baseline, with stale target conflicts leaving both unchanged. | PASS; planned: rules.P81.recovery-adjustment, rules.P81.recovery-arbitration, rules.P81.recovery-transaction; mapped: rules.P81.recovery-adjustment, rules.P81.recovery-arbitration, rules.P81.recovery-transaction; service: none |
| P04.upkeep-warning-context / 7-workspace | Upkeep warnings identify the affected team, officer, roll, or transfer and explain the advisory departure without rendering internal identifiers. | PASS; planned: rules.P81.warning-context; mapped: rules.P81.warning-context; service: none |
| P04.snapshot / 7-workspace | Phase View / Resolution Preview: Persistent Phase Eligibility comes from unresolved events carried into week. | PASS; planned: rules.P04.snapshot; mapped: rules.P81.eligibility, rules.P81.states; service: none |
| P04.stable / 7-workspace | Phase View / Resolution Preview: Ending or creating persistence midweek does not alter eligibility. | PASS; planned: rules.P04.stable; mapped: rules.P81.eligibility; service: none |
| P04.navigation / 7-workspace | Phase View / Resolution Preview: Phase navigation is local and immediate while shared edits are pending. | PASS; planned: rules.P04.navigation; mapped: rules.P81.recovery; service: none |

## P05

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P05.matrix / 5-resolution | Phase View / Resolution Preview: Every required roll, target, choice and acknowledgement controls readiness. | PASS; planned: rules.P05.matrix; mapped: rules.P05.matrix, rules.P78.consumables, rules.P78.consumable-targets; service: none |
| P05.zero / 5-resolution | Phase View / Resolution Preview: Explicit zero differs from missing input; malformed values block Confirmation. | PASS; planned: rules.P05.zero; mapped: rules.P05.zero; service: none |
| P05.optional / 5-resolution | Phase View / Resolution Preview: Optional mitigation unattempted is valid; attempted incomplete mitigation is not. | PASS; planned: rules.P05.optional; mapped: rules.P05.optional; service: none |
| P05.partial / 5-resolution | Phase View / Resolution Preview: Incomplete source still produces a partial preview. | PASS; planned: rules.P05.partial; mapped: rules.P05.partial; service: none |
| P05.upstream / 5-resolution | Phase View / Resolution Preview: Changed upstream choices invalidate dependent input relevance consistently in browser and server. | PASS; planned: rules.P05.upstream; mapped: rules.P05.upstream, rules.P78.projection-parity; service: none |

## P06

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P06.full-plan / 5-resolution | Phase View / Resolution Preview: Preview and committed state diff agree for every action and event, all ledgers, queues and identities. | PASS; planned: rules.P06.full-plan; mapped: rules.P06.full-plan, rules.P06.compound-state, rules.P78.projection-parity, rules.GATE.projection-parity, rules.P80.atomic, rules.P80.rollback; service: live.confirmation |
| P06.baseline / 5-resolution | Phase View / Resolution Preview: Complete Rules Baseline precedes ordered typed Table Adjustments. | PASS; planned: rules.P06.baseline; mapped: rules.P06.baseline; service: none |
| P06.no-hidden / 5-resolution | Phase View / Resolution Preview: Confirmation applies the reviewed plan with no hidden writes or double-applied resource totals. | PASS; planned: rules.P06.no-hidden; mapped: rules.P06.no-hidden, rules.P06.compound-state, rules.GATE.projection-parity, rules.P80.atomic, rules.P80.rollback; service: live.confirmation |

## P07

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P07.reason / 5-resolution | Phase View / Resolution Preview: Shared Table Adjustments and Rules Exceptions require reasons retained in history. | PASS; planned: rules.P07.reason; mapped: rules.P07.reason, rules.P85.adjustment, rules.P85.exception, rules.P85.summary, rules.P86.display; service: live.workspace, live.confirmation |
| P07.distinction / 5-resolution | Phase View / Resolution Preview: Rules Exception permits a choice without changing arithmetic; adjustment changes a result. | PASS; planned: rules.P07.distinction; mapped: rules.P07.distinction; service: none |
| P07.integrity / 5-resolution | Phase View / Resolution Preview: Malformed references, missing entities and nonfinite numbers remain blocked. | PASS; planned: rules.P07.integrity; mapped: rules.P07.integrity, rules.P07.source-references, rules.P78.selected-references; service: none |
| P07.order / 5-resolution | Phase View / Resolution Preview: Ordered conflicting adjustments recompute after baseline changes and target specific event instances. | PASS; planned: rules.P07.order; mapped: rules.P07.order; service: none |

## P08

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P08.reviewed / 6-adapters | Phase View / Resolution Preview: Confirmation requires the exact reviewed draft revision and relevant external source state. | PASS; planned: rules.P08.reviewed; mapped: rules.P80.contract, rules.P80.review-integrity; service: none |
| P08.barrier / 6-adapters | Phase View / Resolution Preview: Confirmation waits for earlier local edits, pauses new edits and does not substitute a newer unreviewed revision. | PASS; planned: rules.P08.barrier; mapped: rules.P80.barrier, rules.P80.contract; service: none |
| P08.atomic / 6-adapters | Phase View / Resolution Preview: Failure applies nothing; simultaneous Confirmations produce one record and one successor. | PASS; planned: rules.P08.atomic; mapped: rules.P80.atomic, rules.P80.rollback, rules.P80.contract; service: none |
| P08.history / 6-adapters | Phase View / Resolution Preview: Full source and ruleset persist immutably; delayed writes to closed identity are rejected. | PASS; planned: rules.P08.history; mapped: storage.history, storage.source, storage.atomic, rules.P80.history, rules.P86.history, rules.P86.authority, rules.P86.navigation, rules.P86.display, rules.P86.labels, rules.P86.controls, rules.P80.contract; service: none |

## P09

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P09.disjoint / 6-adapters | Phase View / Resolution Preview: Disjoint stale semantic edits coexist while same-target stale edits fail visibly. | PASS; planned: rules.P09.disjoint; mapped: rules.P79.contract, rules.P81.recovery, rules.P82.workspace; service: live.workspace, live.persistence |
| P09.aggregate / 6-adapters | Phase View / Resolution Preview: Move and swap are atomic multi-slot edits; obsolete detail edits cannot update a replacement choice. | PASS; planned: rules.P09.aggregate; mapped: rules.P09.aggregate, rules.P79.contract, rules.P82.workspace; service: live.workspace, live.persistence |
| P09.retry / 6-adapters | Phase View / Resolution Preview: Accepted semantic edit increments revision once; retries are idempotent after dropped responses. | PASS; planned: rules.P09.retry; mapped: storage.retry, rules.P79.contract, rules.P80.contract, rules.P85.failed-save; service: live.persistence, live.confirmation |
| P09.delivery / 6-adapters | Phase View / Resolution Preview: Acknowledgements follow submission order and responses are monotonic. | PASS; planned: rules.P09.delivery; mapped: rules.P79.contract; service: live.persistence |
| P09.shared / 6-adapters | Phase View / Resolution Preview: Players edit unlocked slots with immediate feedback and recovery; no per-slot confirmation. | PASS; planned: rules.P09.shared; mapped: rules.P79.contract, rules.P81.recovery, rules.P82.workspace; service: live.workspace |

## P10

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P10.scope / 6-adapters | Phase View / Resolution Preview: Actual unauthenticated or unauthorized campaign writes are rejected for edit, confirm, adjust, buyoff, rank and treasury. | PASS; planned: rules.P10.scope; mapped: storage.scope, storage.reconstruction, rules.P79.authority, rules.P80.authority, rules.P81.gateway; service: live.persistence, live.confirmation |
| P10.references / 6-adapters | Phase View / Resolution Preview: Cross-campaign child references are rejected. | PASS; planned: rules.P10.references; mapped: storage.scope, storage.reconstruction, rules.P79.authority, rules.P80.authority; service: live.persistence, live.confirmation |
| P10.players / 6-adapters | Phase View / Resolution Preview: All authorized players may stage and confirm. | PASS; planned: rules.P10.players; mapped: rules.P79.contract, rules.P80.contract, setup.confirmation; service: live.workspace, live.confirmation |
| P10.gm / 6-adapters | Phase View / Resolution Preview: All users with access to the organization can edit all militia data and use the same controls; there are no separate GM permissions at this stage. | PASS; planned: rules.P10.gm; mapped: rules.P86.authority, rules.P86.controls, initialization.member; service: live.confirmation |

## P11

Sources: [R208: ## Weekly Sequence (Militias in Play)](../docs/ai/ironfang-militia/militia-rules.md); [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D56: tests/rules/decision-56.md](../tests/rules/decision-56.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [AUDIT54: tests/rules/audit-inventory.json](../tests/rules/audit-inventory.json); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| P11.context-setup / 3-context | Isolated ledger/setup accepts advisory incomplete facts, rejects malformed numbers and validates campaign-owned references. | PASS; planned: context.form, context.references, context.ui-targets, context.roster-reference; mapped: context.form, context.references, context.ui-targets, context.roster-reference; service: none |
| P11.setup-lifecycle / 7-workspace | New and existing militia setup create one ordinary draft without resolving the week, preserve reference integrity and local navigation, and retain advisory deviations. | PASS; planned: setup.lifecycle; mapped: setup.lifecycle, setup.import, setup.authority, setup.references, setup.confirmation, setup.integrity, setup.navigation, setup.form, setup.carry-form, setup.required-facts; service: none |
| P11.immutable / 8-cutover-rehearsal | Phase View / Resolution Preview: Historical views read complete immutable records rather than live state. | PASS; planned: rules.P11.immutable; mapped: storage.history, rules.P86.history, rules.P86.display, rules.P86.labels; service: live.confirmation |
| P11.effective / 8-cutover-rehearsal | Phase View / Resolution Preview: Newest nonsuperseded record is effective; older records remain an audit trail. | PASS; planned: rules.P11.effective; mapped: storage.history, rules.P86.history, rules.P86.navigation, rules.P86.controls; service: none |
| P11.cutover / 8-cutover-rehearsal | Phase View / Resolution Preview: Paused restartable initialization preserves campaign state, week and carry but resets unfinished choices and history. | PASS; planned: rules.P11.cutover; mapped: initialization.preserve, initialization.preflight, initialization.stale, initialization.retry, initialization.first-use, initialization.queues, initialization.expiry, initialization.unsupported-queue, initialization.delivery, initialization.new-event, initialization.ended-event, initialization.prior-ended-event, initialization.unknown-end, initialization.source-size; service: live.cutover |
| P11.no-execution / 8-cutover-rehearsal | Phase View / Resolution Preview: Initialization creates one empty draft without Upkeep, queue execution or advancement. | PASS; planned: rules.P11.no-execution; mapped: initialization.preserve; service: none |
| P11.legacy / 8-cutover-rehearsal | Phase View / Resolution Preview: No old-version requests are expected after upgrade, so explicit rejection is not required. Recovery before reopening restores compatible state without losing newly accepted work. | PASS; planned: rules.P11.legacy; mapped: cutover.usable, cutover.assets, cutover.enchantment; service: live.cutover |

## GATE

Sources: [D53: tests/rules/decision-53.md](../tests/rules/decision-53.md); [D55: tests/rules/decision-55.md](../tests/rules/decision-55.md); [D57: tests/rules/decision-57.md](../tests/rules/decision-57.md); [CASES: tests/rules/case-inventory.json](../tests/rules/case-inventory.json)

| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |
|---|---|---|
| GATE.projection-parity / 3-test-infrastructure | Identical canonical fixtures through browser and Convex entry paths produce the same Phase Views and Resolution Preview. | PASS; planned: rules.GATE.projection-parity, rules.U01.projection-parity; mapped: rules.U01.projection-parity, rules.P78.projection-parity, rules.P77.projection-parity, rules.P81.workspace, rules.P82.workspace, rules.P83.workspace, rules.P84.workspace, rules.P85.summary, rules.GATE.projection-parity; service: live.workspace, live.confirmation |
| GATE.adapter-contract / 6-adapters | Shared persistence contract scenarios pass against in-memory and actual isolated Convex persistence. | PASS; planned: rules.GATE.adapter-contract; mapped: rules.P79.contract, rules.P80.contract, rules.P80.atomic, rules.P80.rollback; service: live.persistence, live.confirmation |
| GATE.two-player / 3-test-infrastructure | Two authenticated browser contexts agree on edits and Confirmation, retain independent navigation and show conflict recovery. | PASS; planned: rules.GATE.two-player; mapped: none; service: live.workspace, live.confirmation |

## Remaining gaps


## Run evidence

Source fingerprint: `98115c728189f6f0936cda43ce35361402855a61f763d98b14ece37930f650b8`.

Service evidence: complete mandatory first-attempt suite for this source.
