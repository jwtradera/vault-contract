# Vault contract

Requirements:
1) There should be a ‘deposit’, and ‘withdraw’ function that any user can use to deposit and withdraw any whitelisted ERC-20 token on the contract

2) There should also be three additional functions that only admins can call. 
i) ‘pause’ and ii) ‘unpause’ that prevent/enable new deposits or withdrawals from occurring.
iii) whitelistToken that admins call to whitelist tokens

3) The code repository should contain testing for the contract as well. 
i) The repository should also contain instructions in the readme for running tests

4) The vault should be usable by any number of users

- How to build
`npm install`
`npx hardhat compile`

- How to deploy contract
`npx hardhat run scripts/deploy.ts --network mainnet`

- How to test
`npx hardhat test`