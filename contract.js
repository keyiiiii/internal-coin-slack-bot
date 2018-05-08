const HDWalletProvider = require("truffle-hdwallet-provider");
const Web3 = require('web3');
const config = require('./config');
const ABI = require('./abi').abi;

const PROVIDER = new HDWalletProvider(
  config.MNEMONIC,
  "https://ropsten.infura.io/" + config.ACCESS_TOKEN
);

const web3 = new Web3(PROVIDER);

const contract = new web3.eth.Contract(ABI, config.CONTRACT_ADDRESS);

function thanksMessage(address) {
  return contract.methods.thanksMessage(address).call();
}

function thanks(address, message) {
  return contract.methods.thanks(address, message);
}

function balanceOf(address) {
  return contract.methods.balanceOf(address).call();
}

module.exports = { thanksMessage, thanks, balanceOf };