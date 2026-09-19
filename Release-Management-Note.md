# Note about publication using npm release management

## Before submitting a new beta build:
```
npm version prerelease --preid beta
```

## Before submitting a new release build:
```
npm version patch
```

## To submit a beta:
```
npm login
npm publish --tag=beta
```

## To submit a build:
```
npm login
npm publish
```

## To download a npm archive:
```
npm pack homebridge-pichler-pkom4
```
