# [1.0.0-alpha.14](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.13...v1.0.0-alpha.14) (2023-09-18)


### Bug Fixes

* replace retry-axios, add additional retry logic ([2da9334](https://github.com/ardriveapp/turbo-sdk/commit/2da93347c04467c491248431990a2a969dacd4e4))

# [1.0.0-alpha.13](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.12...v1.0.0-alpha.13) (2023-09-18)


### Bug Fixes

* **retry-axios:** pin retry-axios to 3.0.0 ([2afbc26](https://github.com/ardriveapp/turbo-sdk/commit/2afbc26ca248f1c0d20409a6814f2156923b384f))

# [1.0.0-alpha.12](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.11...v1.0.0-alpha.12) (2023-09-18)


### Bug Fixes

* use .cjs as base for types to avoid reference require errors ([18101b6](https://github.com/ardriveapp/turbo-sdk/commit/18101b6f624968222ce199329ad526730052adcd))

# [1.0.0-alpha.11](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.10...v1.0.0-alpha.11) (2023-09-18)


### Bug Fixes

* add separate folder for types, use it in named exports ([7bd1e63](https://github.com/ardriveapp/turbo-sdk/commit/7bd1e6310c5efdb435a4b89cc922266a85be44d4))

# [1.0.0-alpha.10](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.9...v1.0.0-alpha.10) (2023-09-18)


### Bug Fixes

* wrong path for types! ([d98897e](https://github.com/ardriveapp/turbo-sdk/commit/d98897e16dc28af64c314d7b911e63c23ab2d722))

# [1.0.0-alpha.9](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.8...v1.0.0-alpha.9) (2023-09-18)


### Bug Fixes

* add module to package.json and tweak types ([0afba5f](https://github.com/ardriveapp/turbo-sdk/commit/0afba5f9929c021ba9921a0eee7084463fc54bd0))

# [1.0.0-alpha.8](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.7...v1.0.0-alpha.8) (2023-09-18)


### Bug Fixes

* update main and types path in package.json ([b44678c](https://github.com/ardriveapp/turbo-sdk/commit/b44678cc2335d94eb82d97864dd067c44c87c244))

# [1.0.0-alpha.7](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.6...v1.0.0-alpha.7) (2023-09-18)


### Bug Fixes

* add main import and allow wildcard imports ([edf9d27](https://github.com/ardriveapp/turbo-sdk/commit/edf9d2712fc6494087215c27dab9d4d330d52529))

# [1.0.0-alpha.6](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.5...v1.0.0-alpha.6) (2023-09-18)


### Bug Fixes

* **cjs:** add separate cjs and esm outputs ([c8b2101](https://github.com/ardriveapp/turbo-sdk/commit/c8b2101ecf2b0fc5ae86bbf70b14f50ad5c6be0d))

# [1.0.0-alpha.5](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.4...v1.0.0-alpha.5) (2023-09-18)


### Bug Fixes

* **wildcard:** allow wildcard exports for older projects ([1aa0827](https://github.com/ardriveapp/turbo-sdk/commit/1aa0827c146d07314624114957183fb70a0d3cf0))

# [1.0.0-alpha.4](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2023-09-18)


### Bug Fixes

* remove package.json from lib directory ([46a5946](https://github.com/ardriveapp/turbo-sdk/commit/46a5946ed418ba7f9333a059dc9836fb763eebfb))

# [1.0.0-alpha.3](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2023-09-12)


### Bug Fixes

* type imports for web and node ([9602f17](https://github.com/ardriveapp/turbo-sdk/commit/9602f17ee68920dffd7a29a7aa5b2c45e6315151))

# [1.0.0-alpha.2](https://github.com/ardriveapp/turbo-sdk/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2023-09-12)


### Bug Fixes

* remove postinstall command ([e51141c](https://github.com/ardriveapp/turbo-sdk/commit/e51141cfa05d1ef4294f55f3c9cb47845c1995a9))

# 1.0.0-alpha.1 (2023-09-12)


### Bug Fixes

* add owner to TurboUploadDataItemResponse and remove byteCount ([14f75bd](https://github.com/ardriveapp/turbo-sdk/commit/14f75bdb25ec8d117154f85c51393760db646a32))
* change name of public facing clients. ([7925b99](https://github.com/ardriveapp/turbo-sdk/commit/7925b99f0515cd4af257287a64270a890a5bab39))
* move from getWincPriceForBytes to getUploadCosts ([1b50b2d](https://github.com/ardriveapp/turbo-sdk/commit/1b50b2dd48076368acb3a629386839054fa57dbb))
* revert to single file upload/data item upload ([1ccbbfa](https://github.com/ardriveapp/turbo-sdk/commit/1ccbbfa1cdec9b560c6045cbf66b52a1cce3f7e5))
* update web signer and cleanup examples ([97fd29b](https://github.com/ardriveapp/turbo-sdk/commit/97fd29b38adf9e6e75475432fe8281d6c3d1ce46))


### Features

* abstract axios to TurboHTTPService class ([6592ac8](https://github.com/ardriveapp/turbo-sdk/commit/6592ac83b2b3314fab43c84fa82da08f71c05b57))
* abstract JWKInterface used in AuthenticatedPayment and AuthenticatedUploadService ([bd4f69d](https://github.com/ardriveapp/turbo-sdk/commit/bd4f69d499a7541665f2bfa60298c3b84a9b519a))
* add remaining unauthenticated apis for payment service, introduce some new types, add tests ([8d56fd7](https://github.com/ardriveapp/turbo-sdk/commit/8d56fd79bc83936c0f13969dfccc0ef4424fcfab))
* add uploadFiles implementation for node and web ([7c454f5](https://github.com/ardriveapp/turbo-sdk/commit/7c454f543d4bc9014b0a1afe101473af98755b45))
* break services into auth vs unauth ([56269be](https://github.com/ardriveapp/turbo-sdk/commit/56269be1dda8216e18a20ff88be449a47d7ac580))
* inital implementation of TurboWebClient and TurboNodeClient ([39ea171](https://github.com/ardriveapp/turbo-sdk/commit/39ea171782a993e55585ac8ecd5445bfa7076a34))
* introduce AbortController ([8f636b1](https://github.com/ardriveapp/turbo-sdk/commit/8f636b1e9b0a5d0ab67765f93e22ab145ed8fdec))
* introduce uploadSignedDataItem interface, implement for node ([c2448fd](https://github.com/ardriveapp/turbo-sdk/commit/c2448fdcfe76f08269d1cefb732f673cdee439d2))
* remove TurboDataItemVerifier ([fee5675](https://github.com/ardriveapp/turbo-sdk/commit/fee5675e6143f52f914d465950b9268b9b9a6406))
* **sdk:** all uphill from here 🚀 PE-4064 ([aa4f06f](https://github.com/ardriveapp/turbo-sdk/commit/aa4f06f408f495ef08f87d31c15244920eccd61e))