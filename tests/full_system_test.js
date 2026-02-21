
// Native fetch is available in Node 18+
const assert = require('assert');

const API_URL = 'http://localhost:3001/api';
let tokenA = '';
let tokenB = '';
let roomId = '';
let roomCode = '';
let botGameId = '';

async function request(endpoint, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    // Use native fetch if available, else require (handling older node versions if necessary)
    // Assuming Node 18+ environment based on recent Next.js usage
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
}

async function runTests() {
    console.log('🚀 Starting Comprehensive System Test...\n');

    try {
        // 1. Auth - Register User A
        console.log('1. Registering User A...');
        const userA = `userA_${Date.now()}`;
        const resA = await request('/auth/register', 'POST', { username: userA, password: 'password123' });
        if (!resA.data.success) throw new Error(`Register A failed: ${resA.data.error}`);
        tokenA = resA.data.data.token;
        console.log('✅ User A Registered');

        // 2. Auth - Register User B
        console.log('2. Registering User B...');
        const userB = `userB_${Date.now()}`;
        const resB = await request('/auth/register', 'POST', { username: userB, password: 'password123' });
        if (!resB.data.success) throw new Error(`Register B failed: ${resB.data.error}`);
        tokenB = resB.data.data.token;
        console.log('✅ User B Registered');

        // 3. Room - Create Room (User A)
        console.log('3. Creating Room...');
        const resRoom = await request('/rooms', 'POST', {}, tokenA);
        if (!resRoom.data.success) throw new Error(`Create Room failed: ${resRoom.data.error}`);
        roomId = resRoom.data.data.room.id;
        roomCode = resRoom.data.data.room.code;
        console.log(`✅ Room Created: ${roomCode}`);

        // 4. Room - Join Room (User B)
        console.log('4. Joining Room...');
        const resJoin = await request(`/rooms/${roomCode}/join`, 'POST', {}, tokenB);
        if (!resJoin.data.success) throw new Error(`Join Room failed: ${resJoin.data.error}`);
        console.log('✅ User B Joined Room');

        // 5. Game - Move (User A - X)
        console.log('5. Multiplayer Move (User A)...');
        // A is Player 1 (X)
        const resMoveA = await request(`/game/${roomId}/move`, 'POST', { position: 4, version: 0 }, tokenA);
        if (!resMoveA.data.success) throw new Error(`User A Move failed: ${resMoveA.data.error}`);
        console.log('✅ User A Moved (Center)');

        // 6. Bot - Create Game
        console.log('6. Creating Bot Game...');
        const resBotGame = await request('/bot/create', 'POST', { goFirst: true }, tokenA);
        if (!resBotGame.data.success) throw new Error(`Create Bot Game failed: ${resBotGame.data.error}`);
        botGameId = resBotGame.data.data.game.id;
        console.log('✅ Bot Game Created');

        // 7. Bot - Make Move
        // This was the BUGGY part
        console.log('7. Making Bot Game Move...');
        const resBotMove = await request(`/bot/${botGameId}/move`, 'POST', { position: 4, version: 0 }, tokenA);

        if (!resBotMove.data.success) {
            console.error('❌ Bot Move Failed Response:', JSON.stringify(resBotMove.data, null, 2));
            throw new Error(`Bot Move failed: ${resBotMove.data.error}`);
        }
        console.log('✅ Bot Game Move Successful!');
        console.log('   Bot Response Move:', resBotMove.data.data.botMove);

        console.log('\n✨ ALL TESTS PASSED! System is functioning correctly.');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        process.exit(1);
    }
}

runTests();
