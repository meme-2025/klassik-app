#!/usr/bin/env node
/*
  Test script for wallet auth flow:
  - Requires Node 18+ (global fetch) and ethers installed in project
  Usage:
    set PRIVATE_KEY=0x....
    set SECRET=mysecret
    node backend/scripts/test_wallet_flow.js

*/
const { ethers } = require('ethers');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SECRET = process.env.SECRET || 'testsecret123';

if (!PRIVATE_KEY) {
  console.error('Please set PRIVATE_KEY environment variable with a test wallet private key');
  process.exit(1);
}

async function main() {
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const address = await wallet.getAddress();
  console.log('Using address', address);

  // 1) Request nonce
  const nonceResp = await fetch(`${API_BASE}/api/auth/nonce?address=${address}`);
  const nonceBody = await nonceResp.json();
  console.log('nonce response:', nonceResp.status, nonceBody);
  if (!nonceBody || !nonceBody.message) {
    console.error('Failed to get nonce');
    process.exit(2);
  }

  // 2) Sign message
  const signature = await wallet.signMessage(nonceBody.message);
  console.log('signature:', signature);

  // 3) Register with signature + secret
  const registerResp = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: address, password: SECRET, signature })
  });
  const registerBody = await registerResp.json();
  console.log('register response:', registerResp.status, registerBody);

  // 4) Sign-in with wallet
  const signinResp = await fetch(`${API_BASE}/api/auth/signin-with-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, signature })
  });
  const signinBody = await signinResp.json();
  console.log('signin response:', signinResp.status, signinBody);
}

main().catch(err => {
  console.error('Test script failed:', err);
  process.exit(10);
});
