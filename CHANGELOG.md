## [1.39.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.39.1...v1.39.2) (2025-12-15)


### Bug Fixes

* **deps:** bump dependencies above known security vulnerabilities PE-8785 ([650c4ae](https://github.com/ardriveapp/turbo-sdk/commit/650c4ae98747edf0decda589ec9c4ade5677d7e6))

## [1.39.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.39.0...v1.39.1) (2025-12-11)


### Bug Fixes

* **deps:** bump dependencies above known security vulnerabilities PE-8785 ([55405b2](https://github.com/ardriveapp/turbo-sdk/commit/55405b27e2ec1c75d4325b95714a7beb74cf88b9))

# [1.39.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.38.2...v1.39.0) (2025-12-10)


### Bug Fixes

* **git:** add post publish step to produce dist tag with web bundle for jsdeliver ([0dff815](https://github.com/ardriveapp/turbo-sdk/commit/0dff8150ee936fbb1adfa35e437d8bd63451411b))


### Features

* **base-ario:** init SDK and CLI base-ario implementation PE-8763 ([db2c745](https://github.com/ardriveapp/turbo-sdk/commit/db2c745c3ade1b6e1921d433388f38e324b8f44d))

## [1.38.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.38.1...v1.38.2) (2025-12-09)


### Bug Fixes

* **deps:** bump several dependencies above known security vulnerabilities PE-8785 ([fc8df83](https://github.com/ardriveapp/turbo-sdk/commit/fc8df8391e4ce7e28a01632bc35d696e29fb785f))

## [1.38.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.38.0...v1.38.1) (2025-12-09)


### Bug Fixes

* **bundle:** remove web bundle from npm package, serve via GitHub releases ([1e8ab07](https://github.com/ardriveapp/turbo-sdk/commit/1e8ab076363b187adf42547a2a3d9e6c68d71446))


# [1.38.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.37.0...v1.38.0) (2025-12-08)


### Features

* **logger:** default to non-dependency driven logger class PE-8777 ([f2bdff2](https://github.com/ardriveapp/turbo-sdk/commit/f2bdff2239ea2b93f2dc07193a943168f17b03d6))

# [1.37.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.36.0...v1.37.0) (2025-12-04)

### Features

* **x402:** init base-usdc x402 route PE-8587 ([dda977f](https://github.com/ardriveapp/turbo-sdk/commit/dda977f684051fa92ad61cebfeff771660654015))

# [1.36.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.35.0...v1.36.0) (2025-11-04)


### Bug Fixes

* **cli:** address PR [#320](https://github.com/ardriveapp/turbo-sdk/issues/320) review comments ([c723226](https://github.com/ardriveapp/turbo-sdk/commit/c72322697596a36072217e7880a96554443e4611))


### Features

* **cli:** add --show-progress flag for upload operations PE-8644 ([f7c7ea2](https://github.com/ardriveapp/turbo-sdk/commit/f7c7ea2c3b0dfd0b58d974c6b02344895132ced8))


### Features

* **cli:** add --show-progress flag for upload operations PE-8644 ([f7c7ea2](https://github.com/ardriveapp/turbo-sdk/commit/f7c7ea2c3b0dfd0b58d974c6b02344895132ced8))

# [1.35.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.34.0...v1.35.0) (2025-10-31)


### Features

* **usdc:** include usdc in supported Eth Token types for wallet adapter compatibility ([75f443c](https://github.com/ardriveapp/turbo-sdk/commit/75f443c34c5d700f6c923899853ffdd08c024734))
* **usdc:** init usdc for eth, polygon, base networks PE-7482 ([8fafe6e](https://github.com/ardriveapp/turbo-sdk/commit/8fafe6eed4c8845562d387e1f9be93e1774d476a))

# [1.34.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.33.1...v1.34.0) (2025-10-28)


### Features

* **cross chain tx:** init crypto payments to custom destination addresses PE-6013 ([2352f24](https://github.com/ardriveapp/turbo-sdk/commit/2352f248122e3a7a62e4597f3a4dce4b64d3eaff))

## [1.33.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.33.0...v1.33.1) (2025-10-27)


### Bug Fixes

* **factory:** enable POL browser wallet support via walletAdapter ([5dcb108](https://github.com/ardriveapp/turbo-sdk/commit/5dcb108e13d6de5c58bb9749a0851cfc898b61b7))

# [1.33.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.32.1...v1.33.0) (2025-10-22)


### Features

* add folder upload progress events ([35f4ab6](https://github.com/ardriveapp/turbo-sdk/commit/35f4ab6763a7538ad8b8bdad4246f6d3bddd5c8c))

## [1.32.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.32.0...v1.32.1) (2025-10-13)


### Bug Fixes

* **sol:** allow window.solana to be passed to walletAdapter PE-8557 ([c0f7ba1](https://github.com/ardriveapp/turbo-sdk/commit/c0f7ba15a1853beab1064858144483de446b1fa5))
* **sol:** fulfill signMessage and toString in arbundles compatible way PE-8557 ([37f6448](https://github.com/ardriveapp/turbo-sdk/commit/37f6448fa6781cb2a06dfd22b4faca31102946e6))

# [1.32.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.31.1...v1.32.0) (2025-09-29)


### Features

* **onDemand:** add cryptoTopUpOnDemand upload SDK setting PE-8456 ([117a80b](https://github.com/ardriveapp/turbo-sdk/commit/117a80b3dd197d9b9f03dca9f62ac6c9cb2fd0e5))
* **onDemand:** add onDemand upload CLI setting PE-8456 ([c813e5c](https://github.com/ardriveapp/turbo-sdk/commit/c813e5c7deefb637c6625c4a5a89357611b1b123))

## [1.31.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.31.0...v1.31.1) (2025-09-11)


### Bug Fixes

* allow base-eth on wallet adapter PE-8541 ([7353eb2](https://github.com/ardriveapp/turbo-sdk/commit/7353eb2f71b6c0f5bf9ac762401d50708d374633))
* **eth web signer:** access public key via signer var; `this` is not in scope PE-8541 ([513f84e](https://github.com/ardriveapp/turbo-sdk/commit/513f84e71a457e8116049ede78c6f930c5e8ed6d))

# [1.31.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.30.0...v1.31.0) (2025-09-03)


### Bug Fixes

* **retry:** use internal retry strategy handling ([da6d517](https://github.com/ardriveapp/turbo-sdk/commit/da6d5172e6cb232ff6415be04224750de28beb8d))


### Features

* **async fianlize:** init async finalize handling PE-5267 ([a78df0a](https://github.com/ardriveapp/turbo-sdk/commit/a78df0a0c307641af4bbd387b315270ee10a91c2))
* **async fianlize:** use new receipt API on status; finish async finalize flow PE-8461 ([99bcdfa](https://github.com/ardriveapp/turbo-sdk/commit/99bcdfa83ed61c6239e0aa45792b8c4f73631cef))
* **upload:** init multipart upload APIs for large files PE-5267 ([d98bf08](https://github.com/ardriveapp/turbo-sdk/commit/d98bf08d483ea877c474794bf783113d0dfeafc4))

# [1.30.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.29.0...v1.30.0) (2025-08-04)


### Features

* **top-up:** add payment-intent SDK method PE-8003 ([403d0b4](https://github.com/ardriveapp/turbo-sdk/commit/403d0b428ad82cf718574c4cbf74814629110492))

# [1.29.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.28.3...v1.29.0) (2025-07-23)


### Bug Fixes

* convert to blob on Firefox and Safari PE-8313 ([30a7cc4](https://github.com/ardriveapp/turbo-sdk/commit/30a7cc497233efbafad9bbb904ebafaef2edb55e))
* **imports:** remove CLI imports from common ([d0b9e4f](https://github.com/ardriveapp/turbo-sdk/commit/d0b9e4fd98c89e5349ab2c1ff3086fee6d9de1a2))


### Features

* add cli util that checks a folder of data items for validity ([447cc23](https://github.com/ardriveapp/turbo-sdk/commit/447cc2341f7653bd21f4fc9165ead73147882d07))

## [1.28.3](https://github.com/ardriveapp/turbo-sdk/compare/v1.28.2...v1.28.3) (2025-07-03)


### Bug Fixes

* **kyve:** use native node kyve signing implementation ([01a738f](https://github.com/ardriveapp/turbo-sdk/commit/01a738f4382f9cb3f64780e8125aa857d3e6b4e4))

## [1.28.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.28.1...v1.28.2) (2025-06-27)


### Bug Fixes

* use windows OS compatible manifest ([b192596](https://github.com/ardriveapp/turbo-sdk/commit/b192596f6e1308565f85411f4fca57d5bafcf12e))

## [1.28.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.28.0...v1.28.1) (2025-06-24)


### Bug Fixes

* use normalized getReleativePath ([5eca997](https://github.com/ardriveapp/turbo-sdk/commit/5eca997b98181dd5f1f17a0033175f9cc0b95cb2))

# [1.28.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.27.0...v1.28.0) (2025-06-18)


### Bug Fixes

* **payment:** only append promo codes if provided ([7afef05](https://github.com/ardriveapp/turbo-sdk/commit/7afef0525a3f956975983ee63c5b4518da704071))


### Features

* **topup:** add support for callback urls in createCheckoutSession ([a98a277](https://github.com/ardriveapp/turbo-sdk/commit/a98a27726bf224b2c69ec817f6acd4a5da2d375c))

# [1.27.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.26.0...v1.27.0) (2025-06-10)

### Features

* **bytes-to-usd:** init fiat-estimate command and bytes --currency special case PE-8142 ([ffe0573](https://github.com/ardriveapp/turbo-sdk/commit/ffe0573d121ea21513fff6e1c468309346631275))
* **stream signer:** add web stream signer ([1cf2159](https://github.com/ardriveapp/turbo-sdk/commit/1cf2159cf82fa983e32c9f139e21a99f6124cebf))
* **turbo uploadFile:** extend uploadFile interface to accept a file param for File or filePath ([f70c3be](https://github.com/ardriveapp/turbo-sdk/commit/f70c3be852b93d2c1c6482a2065f9624657f842f))

# [1.26.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.25.0...v1.26.0) (2025-06-02)


### Features

* **emitter:** use a global TurboEventEmitter that submits all requests and manages progress internally ([f01645e](https://github.com/ardriveapp/turbo-sdk/commit/f01645e452402a7f65613ec28e2d26c131a38b21))
* **events:** add signing-success and upload-success events ([c837540](https://github.com/ardriveapp/turbo-sdk/commit/c837540e380af92981d4179a26ddaac574cd7fde))
* **events:** add SigningEmitter that emits events for signing ([4330ca9](https://github.com/ardriveapp/turbo-sdk/commit/4330ca90de5a8df8370a04f812e7d1c2d1e4a060))

# [1.25.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.24.0...v1.25.0) (2025-05-02)


### Features

* **uploadData:** add uploadData api for web and node PE-8042 ([2ff41e8](https://github.com/ardriveapp/turbo-sdk/commit/2ff41e840bd1a360bf528bef6992f44f6668aef3))
* **uploadData:** rely on Buffer polyfill PE-8042 ([4cef4be](https://github.com/ardriveapp/turbo-sdk/commit/4cef4befc8a85f7988804e8600e9f992a14cfe2c))
* **uploadData:** simplify by just using a buffer when possible PE-8042 ([da903a2](https://github.com/ardriveapp/turbo-sdk/commit/da903a242542c9fc30a3091e4085ee002c18f145))
* **upload:** rename uploadData to upload and update README PE-8042 ([a8124e1](https://github.com/ardriveapp/turbo-sdk/commit/a8124e1ff77a4bf6da408c703d948dc730e86273))

# [1.24.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.23.5...v1.24.0) (2025-05-02)


### Features

* **ario:** extend crypto fund for $ARIO payments PE-8005 ([457eb85](https://github.com/ardriveapp/turbo-sdk/commit/457eb85b7dda11a159ac39c5971a6f003a42aa05))

## [1.23.5](https://github.com/ardriveapp/turbo-sdk/compare/v1.23.4...v1.23.5) (2025-04-16)


### Bug Fixes

* **arweave fund:** use a working GQL query PE-7980 ([848afdc](https://github.com/ardriveapp/turbo-sdk/commit/848afdc6493ba1149ee6b90ba8fdcb8c3eb27b1c))

## [1.23.4](https://github.com/ardriveapp/turbo-sdk/compare/v1.23.3...v1.23.4) (2025-04-09)


### Bug Fixes

* **deps:** include bitcoinjs-lib as a dependency ([794748b](https://github.com/ardriveapp/turbo-sdk/commit/794748b045a58b8de9b9ac7f329845b061cc0610))
* **types:** avoid using node: imports as they are only available in node environments ([37e5706](https://github.com/ardriveapp/turbo-sdk/commit/37e5706c6a95484ad49208ca2c88c45f2dfa79ca))

## [1.23.3](https://github.com/ardriveapp/turbo-sdk/compare/v1.23.2...v1.23.3) (2025-04-07)


### Bug Fixes

* gracefully access platform on in CLI constants file PE-7931 ([ab9d7a0](https://github.com/ardriveapp/turbo-sdk/commit/ab9d7a0d5dfef42650ca80ddd61da72ce99f6d71))
* standardize winston import PE-7931 ([7e4a8bd](https://github.com/ardriveapp/turbo-sdk/commit/7e4a8bdec081987bdb2e00d50a3547ca4ef704b9))

## [1.23.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.23.1...v1.23.2) (2025-04-04)


### Bug Fixes

* **kyve:** bump to kyve 1.4.5 to resolve kyve gas fee issue PE-7921 ([11e5226](https://github.com/ardriveapp/turbo-sdk/commit/11e52262dcba82d928036f9f3f3aa47a40a9023d))

## [1.23.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.23.0...v1.23.1) (2025-03-19)


### Bug Fixes

* use correct kyve signer type PE-7834 ([b82e2db](https://github.com/ardriveapp/turbo-sdk/commit/b82e2db7e887e3a7023f72c113191b83effb189f))

# [1.23.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.22.1...v1.23.0) (2025-02-27)


### Features

* **eth on base:** add methods/commands for funding ETH on base network for SDK and CLI PE-7481 ([a5ac224](https://github.com/ardriveapp/turbo-sdk/commit/a5ac22488fdad80941aa32091dd92219294e2560))

## [1.22.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.22.0...v1.22.1) (2025-02-10)


### Bug Fixes

* **data post:** add retry capability on upload file as intended PE-7598 ([cfe312b](https://github.com/ardriveapp/turbo-sdk/commit/cfe312b435096b697e70d5f6db2f76714a29f630))
* **http:** catch uncaught `get` errors, return best effort error message PE-7598 ([c884edc](https://github.com/ardriveapp/turbo-sdk/commit/c884edc64b71ab9a37f46fa614aa30a9318754b9))

# [1.22.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.21.0...v1.22.0) (2025-01-22)


### Bug Fixes

* **arconnect:** use signDataItem method, signature is deprecated PE-7455 ([0cd3ca7](https://github.com/ardriveapp/turbo-sdk/commit/0cd3ca7f59f72766f7cbc8cafb3e1fa8e5a71f24))


### Features

* **cli:** add custom Arweave tags support ([4b367e2](https://github.com/ardriveapp/turbo-sdk/commit/4b367e28ab54df4dfa53ac477b963c49af12fb21))
* **cli:** add tag support for file and folder uploads ([5580085](https://github.com/ardriveapp/turbo-sdk/commit/55800857bee7e8be9fdad1599c1a096ec98ee903))

# [1.21.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.20.2...v1.21.0) (2024-11-25)


### Bug Fixes

* include `pol` on exported create signer function PE-7171 ([3586f57](https://github.com/ardriveapp/turbo-sdk/commit/3586f5788e0f18f05b3dc62165db066c4a96b3e8))


### Features

* **token-price:** init new price method PE-7171 ([c4df2f2](https://github.com/ardriveapp/turbo-sdk/commit/c4df2f214dffc6b4cb0c883ab2e0a5ea2ec26e6b))
* **token-price:** init token-price CLI command PE-7171 ([5325173](https://github.com/ardriveapp/turbo-sdk/commit/5325173b97988b849d728d8bbba9df13abf7c879))

## [1.20.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.20.1...v1.20.2) (2024-11-07)


### Bug Fixes

* **share credits:** use web polyfilled safe Buffer.from over Readable.from ([473a469](https://github.com/ardriveapp/turbo-sdk/commit/473a4696d21c03540aec7c18d36e6f4152683b65))

## [1.20.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.20.0...v1.20.1) (2024-11-05)


### Bug Fixes

* access arweave at different levels of default for esm bundle compat PE-7069 ([4c75290](https://github.com/ardriveapp/turbo-sdk/commit/4c752909aae24eed985102511654c6361ede38a5))

# [1.20.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.19.2...v1.20.0) (2024-11-04)


### Bug Fixes

* **arweave:** modify import of Arweave in `ArweaveToken` ([b934677](https://github.com/ardriveapp/turbo-sdk/commit/b934677e00b95283d30bca0bf719d919312aabe2))
* supply starknet dependency for resolving kyve-js -> keplr-wallet import error ([cf5ab39](https://github.com/ardriveapp/turbo-sdk/commit/cf5ab39a3a08afebbb9d4f7b535ddd40fd57798c))


### Features

* add cli helper for --local development endpoints PE-6754 ([79fe7a0](https://github.com/ardriveapp/turbo-sdk/commit/79fe7a0b81daeec18a9ca4aa68fe300d71bee009))
* **delegated payments:** add list-approvals command rather than overloaded balance command  PE-6754 ([ee44ef6](https://github.com/ardriveapp/turbo-sdk/commit/ee44ef6c1176734a72e5e4b310dcd9468028c779))
* **delegated payments:** add paid-by headers for uploads when applicable PE-6754 ([953648e](https://github.com/ardriveapp/turbo-sdk/commit/953648e67719cc3c663ac75a702fd653e33b7c8f))
* **delegated payments:** add revoke approvals to SDK and CLI PE-6754 ([f2d26da](https://github.com/ardriveapp/turbo-sdk/commit/f2d26daa5ee12008dc8173a0ee44bfc2828028ba))
* **delegated payments:** display approvals if they exist on `balance` command PE-6754 ([669dfca](https://github.com/ardriveapp/turbo-sdk/commit/669dfca76332756e93accf1b0a01cfa8538f9e84))
* **delegated payments:** extend turbo.getBalance method to include approval details PE-6754 ([baec107](https://github.com/ardriveapp/turbo-sdk/commit/baec1072b7750cc08bb1588dc5ff2a870f47b3e5))
* **delegated payments:** init logic for create-approval PE-6754 ([1047762](https://github.com/ardriveapp/turbo-sdk/commit/10477621bad131ec85203814ce3846040cba15ea))
* **delegated payments:** push created/revoked approvals into upload response if they exist PE-6754 ([33da73d](https://github.com/ardriveapp/turbo-sdk/commit/33da73d29b6db6f706f1debd1e83aa5acb5f9ee5))
* **delegated payments:** use any approvals first by default on CLI PE-6754 ([96d4a32](https://github.com/ardriveapp/turbo-sdk/commit/96d4a32fe3d2e84a6dd3742a2d1c981acc786596))
* update credit sharing command and method names ([c3e9bd9](https://github.com/ardriveapp/turbo-sdk/commit/c3e9bd95dc1585e80cdce1b237cab02889976d41))

## [1.19.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.19.1...v1.19.2) (2024-10-21)


### Bug Fixes

* still use relative path for manifest when folderPath inputs with `./` PE-6975 ([23007f7](https://github.com/ardriveapp/turbo-sdk/commit/23007f7115b7699b91110da41581b8023ed6a232))

## [1.19.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.19.0...v1.19.1) (2024-10-17)


### Bug Fixes

* **deps:** pin `@keplr-wallet/cosmos` dependency ([aa424f4](https://github.com/ardriveapp/turbo-sdk/commit/aa424f4d95ae6fd62be37e40d0311103622f3c11))

# [1.19.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.18.0...v1.19.0) (2024-10-03)


### Bug Fixes

* **upload file:** allows buffer type in uploadFile inputs PE-6851 ([7c8d75b](https://github.com/ardriveapp/turbo-sdk/commit/7c8d75bbdc113894f43dfb319bfc17dd3b577285))


### Features

* **web:** implement walletAdapter for SOL and ETH web signing support PE-6052 ([2ab2486](https://github.com/ardriveapp/turbo-sdk/commit/2ab2486b98930db25cf74d9ba84f2ffeef989920))

# [1.18.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.17.0...v1.18.0) (2024-09-27)


### Features

* **cli:** add parameters to inject upload and payment urls PE-6830 ([edf2948](https://github.com/ardriveapp/turbo-sdk/commit/edf29486191bad86007e972e88897c4916784602))

# [1.17.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.16.1...v1.17.0) (2024-09-13)


### Features

* **pol:** add support for matic/pol crypto fund PE-6722 ([ee523ba](https://github.com/ardriveapp/turbo-sdk/commit/ee523bacac0b0e3213e6e132af6b0195cbf64562))
* **pol:** add support for matic/pol token uploads and top ups PE-6721 ([62ff2c8](https://github.com/ardriveapp/turbo-sdk/commit/62ff2c881f51c492b37dc87bfb47354cdc978766))
* **price commands:** init CLI price command PE-6728 ([d737b8e](https://github.com/ardriveapp/turbo-sdk/commit/d737b8e7bdfc9cd3c0eab5d505f805477db16106))

## [1.16.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.16.0...v1.16.1) (2024-09-13)


### Bug Fixes

* bump kyvejs to resolve downstream errors PE-6664 ([3ccc0bf](https://github.com/ardriveapp/turbo-sdk/commit/3ccc0bf06daad6e6c182f4a13d955fc24a9097d7))

# [1.16.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.15.0...v1.16.0) (2024-09-12)


### Bug Fixes

* **cli:** assign token to config PE-6632 ([d6444b2](https://github.com/ardriveapp/turbo-sdk/commit/d6444b27fd3dd774e5ffefbda785cf5f86306f91))


### Features

* **crypto fund:** add --tx-id parameter with submitFundTransaction compatibility and docs PE-6732 ([23b6035](https://github.com/ardriveapp/turbo-sdk/commit/23b6035d3e8edbd9b16864930266880056231c9b))
* **crypto fund:** init confirmation promot PE-6732 ([3714599](https://github.com/ardriveapp/turbo-sdk/commit/3714599bd3fc050e0d97299972de0e8343b6b4ea))
* **crypto fund:** show target wallet in confirmation prompt PE-6732 ([06f1c9a](https://github.com/ardriveapp/turbo-sdk/commit/06f1c9a2a153ec8d5e8103f87617617e3854157d))
* **winc for token:** init getWincForToken PE-6632 ([143cb39](https://github.com/ardriveapp/turbo-sdk/commit/143cb398aa9d13437a34877003a68fc4ecdf6059))

# [1.15.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.14.1...v1.15.0) (2024-09-12)


### Bug Fixes

* repair types returned from payment service PE-6718 ([f97dfcb](https://github.com/ardriveapp/turbo-sdk/commit/f97dfcb4bc042ad4755b7e3fe2bb39ceab8c21bf))


### Features

* enable unauthenticated winc for fiat promo code PE-6716 ([b2ade37](https://github.com/ardriveapp/turbo-sdk/commit/b2ade37b67444f4b0e63041746a39e6385c27d2c))

## [1.14.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.14.0...v1.14.1) (2024-09-11)


### Bug Fixes

* **cli:** assign token to config PE-6632 ([5a0e837](https://github.com/ardriveapp/turbo-sdk/commit/5a0e837853888cb3536ea69a45fe6245b6a8d108))

# [1.14.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.13.0...v1.14.0) (2024-09-11)


### Bug Fixes

* repair dependency errors; upgrade arweave; upgrade to [@ar](https://github.com/ar).io/arbundles PE-6664 ([a2e421f](https://github.com/ardriveapp/turbo-sdk/commit/a2e421f593abe9e37fa52a93e212445ea96bd17e))


### Features

* **upload file:** init cli upload file command PE-6636 ([f802fc5](https://github.com/ardriveapp/turbo-sdk/commit/f802fc5208ef574853f134e8ca3197fc1e6941c0))
* **upload folder:** init CLI command PE-6636 ([17af9f3](https://github.com/ardriveapp/turbo-sdk/commit/17af9f36ff9d826ae92664691d557eb198582ccb))
* **upload folder:** init manifest options PE-6636 ([305bd5a](https://github.com/ardriveapp/turbo-sdk/commit/305bd5a6b49ab9b326954548ab22e75807c9e080))

# [1.13.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.12.0...v1.13.0) (2024-09-06)


### Features

* **balance:** init CLI balance command PE-6635 ([18de656](https://github.com/ardriveapp/turbo-sdk/commit/18de65605d985a901b9211f94ce68fd305c0d8e6))
* **top-up:** init top-up with stripe checkout command PE-6635 ([c43e11b](https://github.com/ardriveapp/turbo-sdk/commit/c43e11bc82f63f9b99e061848787fd1458c71a21))

# [1.12.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.11.0...v1.12.0) (2024-08-30)


### Features

* **balance:** add an unauthenticated getBalance method PE-6630 ([63bb4f8](https://github.com/ardriveapp/turbo-sdk/commit/63bb4f8b05560848a67016d08f6bbe4d3724cf74))
* **native address:** get native address from connected signer PE-6629 ([7432156](https://github.com/ardriveapp/turbo-sdk/commit/7432156311811e921eff99254c4c44dfb97ca353))

# [1.11.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.10.1...v1.11.0) (2024-08-29)


### Bug Fixes

* **cli:** include bin/turbo in argv check PE-6449 ([cf57515](https://github.com/ardriveapp/turbo-sdk/commit/cf575154a679ea846ff049d3390ca0cea6989a7a))


### Features

* **cli:** init a turbo cli tool featuring KYVE crypto fund PE-6449 ([2eff402](https://github.com/ardriveapp/turbo-sdk/commit/2eff402a7d759a91930d898343a0a97f1c2e9cb2))
* **kyve:** add exported isTokenType helper PE-6448 ([bf70d59](https://github.com/ardriveapp/turbo-sdk/commit/bf70d596e9f3f4e31b63525ae533a166206ad736))
* **kyve:** add tokenAmountToBase map PE-6448 ([b2864b3](https://github.com/ardriveapp/turbo-sdk/commit/b2864b3ccad2b0488868b1740fbbf3bb55f1e8d0))
* **kyve:** allow kyve token type for uploads and top ups PE-6447 ([861d542](https://github.com/ardriveapp/turbo-sdk/commit/861d542a7198620e94c1e5210e8c18420953749e))
* **kyve:** init KYVE crypto fund PE-6448 ([120735f](https://github.com/ardriveapp/turbo-sdk/commit/120735f8f0d342d6ebbeb16c05cabcdef2ec20f9))
* **kyve:** update exported types PE-6448 ([e06608c](https://github.com/ardriveapp/turbo-sdk/commit/e06608ccb49e40c8ec0df686838c8ded370c2d2a))

## [1.10.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.10.0...v1.10.1) (2024-08-23)


### Bug Fixes

* expose `token` on unauthenticated turbo factory PE-6569 ([7f0c44c](https://github.com/ardriveapp/turbo-sdk/commit/7f0c44cfc319d0f303d252d0aa73f0d42a635e03))


# [1.10.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.9.0...v1.10.0) (2024-08-15)


### Bug Fixes

* **build:** update build outputs for web and README ([74cce09](https://github.com/ardriveapp/turbo-sdk/commit/74cce094393672b1c96b795f6d1ab642d89b1bc9))
* **logger:** fix winston setImmediate issue in web export for logger ([481cbe6](https://github.com/ardriveapp/turbo-sdk/commit/481cbe6bbe05b542f498f2d68333854259e98497))
* **upload folder:** improve node exports PE-4643 ([a6c073b](https://github.com/ardriveapp/turbo-sdk/commit/a6c073bb8b8e8bebf818f08b2ae4b4613ae28c9f))
* **upload folder:** improve web exports PE-4643 ([4b50778](https://github.com/ardriveapp/turbo-sdk/commit/4b50778707cc74b03058eddd98cf1b8818ec39c4))


### Features

* **upload folder:** add manifest content type PE-4643 ([af35d7b](https://github.com/ardriveapp/turbo-sdk/commit/af35d7bb4841822b62bc892e7dcca451b436117c))
* **upload folder:** add manifestOptions with disable, index, and fallback parameters PE-4643 ([708ea15](https://github.com/ardriveapp/turbo-sdk/commit/708ea157c17450921de2a4d64989508f52ac6a2c))
* **upload folder:** add mime types for content type PE-4643 ([44d1240](https://github.com/ardriveapp/turbo-sdk/commit/44d124006089b21f0cc7649f822e16a3c0a259e9))
* **upload folder:** add throw on failure option PE-4643 ([a258aa6](https://github.com/ardriveapp/turbo-sdk/commit/a258aa6d97573233ef44a7e68c5696d19468b55c))
* **upload folder:** defer to use user defined content type on files when provided PE-4643 ([5d5ef89](https://github.com/ardriveapp/turbo-sdk/commit/5d5ef899686a23adcfffcf196824bb00684ceb88))
* **upload folder:** init web and node upload folder with manifest implementations PE-4643 ([70d3135](https://github.com/ardriveapp/turbo-sdk/commit/70d313538cbe522995d742b923459ed39aecc84c))
* **upload folder:** slice leading `/` from relative manifest paths PE-4643 ([c6e3b7c](https://github.com/ardriveapp/turbo-sdk/commit/c6e3b7c961699a57a5b43626f10283dbe9d4b12e))
* **upload folder:** use concurrency with plimit-lit PE-4643 ([110a424](https://github.com/ardriveapp/turbo-sdk/commit/110a424db68cfca985303187b318e5a4b1c43b30))

# [1.9.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.8.0...v1.9.0) (2024-05-06)


### Bug Fixes

* **eth payments:** setup ETH in default constructor, remove default wait() PE-5992 ([4cbc6bd](https://github.com/ardriveapp/turbo-sdk/commit/4cbc6bd7211014b7ef415f30b5ef08c8b51b7d86))


### Features

* **eth payments:** init eth tx payments PE-5992 ([6351425](https://github.com/ardriveapp/turbo-sdk/commit/6351425d2bfc918df2e864174b76c439ec067cf8))

# [1.8.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.7.1...v1.8.0) (2024-05-02)


### Features

* **solana payments:** init solana token tools for sol payment PE-5993 ([e5ab6a9](https://github.com/ardriveapp/turbo-sdk/commit/e5ab6a9839c5f4fdfeaf6b85d80ae02821336c82))

## [1.7.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.7.0...v1.7.1) (2024-04-25)


### Bug Fixes

* **signer:** use web signer if .window exists PE-6055 ([90cbd56](https://github.com/ardriveapp/turbo-sdk/commit/90cbd5624da8c63ab56a4ef516120df4a8831b65))


# [1.7.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.6.0...v1.7.0) (2024-04-25)


### Features

* **upload:** allow eth and sol signing for upload PE-5941 ([bfcdc4b](https://github.com/ardriveapp/turbo-sdk/commit/bfcdc4b13fc18313034c39f80511cb9b58396fb8))
* **upload:** allow eth/sol signer types PE-5941 ([9902501](https://github.com/ardriveapp/turbo-sdk/commit/99025013837afeeeaab7b66756296ea78538b62b))


# [1.6.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.5.0...v1.6.0) (2024-04-24)


### Features

* **top up:** allow eth/sol destination for fiat top up PE-6034 ([dabe123](https://github.com/ardriveapp/turbo-sdk/commit/dabe123270a55aa0167de0fec0029747cf639d8a))
* **top up:** allow eth/sol destination for fiat top up PE-6034 ([8ca05ab](https://github.com/ardriveapp/turbo-sdk/commit/8ca05ab8c81cdee16bf7fb5ec36b42d6e8769ff1))

# [1.5.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.4.2...v1.5.0) (2024-04-16)


### Bug Fixes

* export Arconnect and ArweaveSigner from env specific signers ([b94ffdc](https://github.com/ardriveapp/turbo-sdk/commit/b94ffdc6eef200d75edb88dc7a42f500b4892636))
* **fund with ar:** add web esm compatible arweave export PE-5849 ([9681e06](https://github.com/ardriveapp/turbo-sdk/commit/9681e067f8ac03c381bef0c19e45454b5e9e14d9))


### Features

* **crypto payments:** init fund methods PE-5849 ([5ec1687](https://github.com/ardriveapp/turbo-sdk/commit/5ec1687ca2d761cb3a516e5276cf9f67c5a4f20c))
* **crypto payments:** refactor arweave-js out of signer PE-5849 ([aa7836b](https://github.com/ardriveapp/turbo-sdk/commit/aa7836bbd18cffb87b83a182e5cfe9a60f6c520f))
* **fund with ar:** add ToTokenAmount helper utils PE-5849 ([37417dd](https://github.com/ardriveapp/turbo-sdk/commit/37417ddbe16b463fd2953ca37567e1cba7557a0b))
* **fund with ar:** catch polling error PE-5849 ([8bb9b1f](https://github.com/ardriveapp/turbo-sdk/commit/8bb9b1f6438f46c5b49fd05ddfcbc2c9655ceb3d))
* **fund with ar:** continue polling on request error PE-5849 ([a324ca1](https://github.com/ardriveapp/turbo-sdk/commit/a324ca1f02beb7faa171e0550cd6505926fa7dfc))
* **fund with ar:** throw no wallet found as error PE-5849 ([d1d2e7a](https://github.com/ardriveapp/turbo-sdk/commit/d1d2e7aa1f33df3445d3d6bbc46c37d4ee1bd196))
* **signers:** exports arbundles ArconnectSigner and ArweaveSigner ([41c85ed](https://github.com/ardriveapp/turbo-sdk/commit/41c85ed758bd6e4f23c6e11dd21f745afa18e5ed))

## [1.4.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.4.1...v1.4.2) (2024-03-15)


### Bug Fixes

* **arbundles:** pin arbundles to 0.9.9 and run tests locally ([c92ce38](https://github.com/ardriveapp/turbo-sdk/commit/c92ce381b63b378443dee5f0d73578df8e3fc7fe))

## [1.4.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.4.0...v1.4.1) (2024-03-11)


### Bug Fixes

* **checkout session:** correct query param, change type, add coverage PE-5790 ([4fc6115](https://github.com/ardriveapp/turbo-sdk/commit/4fc6115ebf74812cd6cf926a525457569d2153fe))

# [1.4.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.3.0...v1.4.0) (2024-01-30)


### Features

* **ui mode:** support query param for checkout session ui mode PE-5332 ([18dec34](https://github.com/ardriveapp/turbo-sdk/commit/18dec3417ec144eab85d0e11ea7b06eb6e6ccd34))


# [1.3.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.2.0...v1.3.0) (2024-01-03)


### Bug Fixes

* **web:** ensure we have the public key for arconnect wallets when signing data ([7dd9ae0](https://github.com/ardriveapp/turbo-sdk/commit/7dd9ae00e4059662783800bf8dc57831065bc2a4))
* **web:** remove reference to `node:crypto` in websigner, use signer to signer to sign header ([45a413d](https://github.com/ardriveapp/turbo-sdk/commit/45a413d458c6f8e2f1bbc9bf93e61977dba16643))

### Features

* **signer:** allow an optional signer to be passed instead of JWK for signing data items ([b70cfa2](https://github.com/ardriveapp/turbo-sdk/commit/b70cfa202508b21750738eadf0596592892f8f59))

# [1.2.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.1.1...v1.2.0) (2023-12-15)


### Features

* **data item opts:** init tags anchor and target support PE-5035 ([6b95881](https://github.com/ardriveapp/turbo-sdk/commit/6b95881cb478b491cac5f6ec81143f6bf944fbcb))

## [1.1.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.1.0...v1.1.1) (2023-12-14)


### Bug Fixes

* **exports:** use bundled export to avoid issue with polyfilled features needed for web ([6e559d6](https://github.com/ardriveapp/turbo-sdk/commit/6e559d6c05d9f9621baad3a4026743755cf42b8a))
* **exports:** web exports reference an invalid build path ([d663498](https://github.com/ardriveapp/turbo-sdk/commit/d663498603cc1d6812838b382a4c6c7e6e87540a))
* **polyfills:** update esbuild script to include crypto polyfill ([61b66ec](https://github.com/ardriveapp/turbo-sdk/commit/61b66ecdbad9dc3e72b688143fd65c5ce18a46c8))

# [1.1.0](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.2...v1.1.0) (2023-11-10)


### Bug Fixes

* **axios:** set `maxRedirects` to `0` on our axios instances ([0e7ae17](https://github.com/ardriveapp/turbo-sdk/commit/0e7ae17f0bf028114f63deaafcea6ef60f2beac3))


### Features

* **logger:** add configurable global logger ([e6f341a](https://github.com/ardriveapp/turbo-sdk/commit/e6f341ad11b130bb72e83810da7265467cfa69f9))

## [1.0.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.1...v1.0.2) (2023-11-03)


### Bug Fixes

* **upload:** update the default upload service URL ([f718af9](https://github.com/ardriveapp/turbo-sdk/commit/f718af9ddd2cef6dd61a896bec0d061a3956cfc6))

## [1.0.1](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0...v1.0.1) (2023-09-27)


### Bug Fixes

* **headers:** add default headers for all HTTP requests ([2b58545](https://github.com/ardriveapp/turbo-sdk/commit/2b5854565cde9af1d51d3703615b11a19e59fc6e))
* **release:** use script that updates built version.js files ([433f520](https://github.com/ardriveapp/turbo-sdk/commit/433f52090b41bcfa230fac2863729a154aaeeae8))
* **version:** update version.js to proper version on build and commit it back to git after a release ([ab51183](https://github.com/ardriveapp/turbo-sdk/commit/ab51183c1e81adcbf38104f01056a7666f173bba))


# 1.0.0 (2023-09-26)


Initial release of the Turbo SDK.
