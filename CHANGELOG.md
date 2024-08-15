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
