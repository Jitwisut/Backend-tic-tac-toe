/**
 * Concurrency Test Script
 * Tests race condition handling for simultaneous moves
 */

const request = require('supertest');

// Configure for your backend URL
const API_URL = process.env.API_URL || 'http://localhost:3001';

/**
 * Helper to create a test user
 */
async function createUser(username, password) {
    const response = await request(API_URL)
        .post('/api/auth/register')
        .send({ username, password });

    if (response.status === 201) {
        return response.body.data;
    }

    // User might already exist, try login
    const loginResponse = await request(API_URL)
        .post('/api/auth/login')
        .send({ username, password });

    return loginResponse.body.data;
}

/**
 * Test: Multiple simultaneous moves to the same position
 * Expected: Only one move should succeed
 */
async function testSimultaneousMoves() {
    console.log('\n=== Test: Simultaneous Moves to Same Position ===');

    try {
        // Create two test users
        const user1 = await createUser(`test_concurrent_1_${Date.now()}`, 'password123');
        const user2 = await createUser(`test_concurrent_2_${Date.now()}`, 'password123');

        if (!user1 || !user2) {
            console.log('❌ Failed to create test users');
            return false;
        }

        console.log('✓ Created test users');

        // Create a room
        const roomResponse = await request(API_URL)
            .post('/api/rooms')
            .set('Authorization', `Bearer ${user1.token}`);

        if (roomResponse.status !== 201) {
            console.log('❌ Failed to create room');
            return false;
        }

        const roomCode = roomResponse.body.data.room.code;
        const roomId = roomResponse.body.data.room.id;
        console.log(`✓ Created room: ${roomCode}`);

        // Join room as player2
        const joinResponse = await request(API_URL)
            .post(`/api/rooms/${roomCode}/join`)
            .set('Authorization', `Bearer ${user2.token}`);

        if (joinResponse.status !== 200) {
            console.log('❌ Failed to join room');
            return false;
        }

        console.log('✓ Player 2 joined room');

        // Player 1 makes first move (position 0)
        const move1Response = await request(API_URL)
            .post(`/api/game/${roomId}/move`)
            .set('Authorization', `Bearer ${user1.token}`)
            .send({ position: 0 });

        if (move1Response.status !== 200) {
            console.log('❌ Player 1 first move failed');
            return false;
        }

        console.log('✓ Player 1 made first move');

        // Now it's Player 2's turn
        // Simulate 10 simultaneous requests from Player 2 to the same position
        const position = 4; // Center position
        const numRequests = 10;

        console.log(`\nSending ${numRequests} simultaneous requests to position ${position}...`);

        const promises = [];
        for (let i = 0; i < numRequests; i++) {
            promises.push(
                request(API_URL)
                    .post(`/api/game/${roomId}/move`)
                    .set('Authorization', `Bearer ${user2.token}`)
                    .send({ position })
            );
        }

        const results = await Promise.all(promises);

        // Count successes and failures
        let successCount = 0;
        let failCount = 0;
        const errors = {};

        for (const result of results) {
            if (result.status === 200) {
                successCount++;
            } else {
                failCount++;
                const errorKey = result.body.error || 'Unknown';
                errors[errorKey] = (errors[errorKey] || 0) + 1;
            }
        }

        console.log(`\nResults:`);
        console.log(`  ✓ Successful moves: ${successCount}`);
        console.log(`  ✗ Failed moves: ${failCount}`);
        console.log(`  Error breakdown:`, errors);

        if (successCount === 1 && failCount === numRequests - 1) {
            console.log('\n✅ PASS: Exactly one move succeeded, race condition handled correctly!');
            return true;
        } else if (successCount > 1) {
            console.log('\n❌ FAIL: Multiple moves succeeded - race condition NOT handled!');
            return false;
        } else {
            console.log('\n⚠️ UNEXPECTED: No moves succeeded');
            return false;
        }
    } catch (error) {
        console.error('Test error:', error);
        return false;
    }
}

/**
 * Test: Multiple users trying to join full room
 * Expected: Only one should succeed
 */
async function testRoomJoinRace() {
    console.log('\n=== Test: Simultaneous Room Join Attempts ===');

    try {
        // Create test users
        const creator = await createUser(`test_room_creator_${Date.now()}`, 'password123');
        const joiners = [];

        for (let i = 0; i < 5; i++) {
            const joiner = await createUser(`test_joiner_${Date.now()}_${i}`, 'password123');
            joiners.push(joiner);
        }

        if (!creator || joiners.length !== 5) {
            console.log('❌ Failed to create test users');
            return false;
        }

        console.log('✓ Created test users');

        // Create a room
        const roomResponse = await request(API_URL)
            .post('/api/rooms')
            .set('Authorization', `Bearer ${creator.token}`);

        const roomCode = roomResponse.body.data.room.code;
        console.log(`✓ Created room: ${roomCode}`);

        // All joiners try to join simultaneously
        console.log(`\nSending ${joiners.length} simultaneous join requests...`);

        const promises = joiners.map(joiner =>
            request(API_URL)
                .post(`/api/rooms/${roomCode}/join`)
                .set('Authorization', `Bearer ${joiner.token}`)
        );

        const results = await Promise.all(promises);

        let successCount = 0;
        let failCount = 0;

        for (const result of results) {
            if (result.status === 200) {
                successCount++;
            } else {
                failCount++;
            }
        }

        console.log(`\nResults:`);
        console.log(`  ✓ Successful joins: ${successCount}`);
        console.log(`  ✗ Failed joins: ${failCount}`);

        if (successCount === 1) {
            console.log('\n✅ PASS: Exactly one player joined, room capacity enforced!');
            return true;
        } else {
            console.log('\n❌ FAIL: Wrong number of successful joins');
            return false;
        }
    } catch (error) {
        console.error('Test error:', error);
        return false;
    }
}

/**
 * Test: Wrong turn attempt
 */
async function testWrongTurn() {
    console.log('\n=== Test: Wrong Turn Attempt ===');

    try {
        const user1 = await createUser(`test_turn_1_${Date.now()}`, 'password123');
        const user2 = await createUser(`test_turn_2_${Date.now()}`, 'password123');

        // Create and join room
        const roomResponse = await request(API_URL)
            .post('/api/rooms')
            .set('Authorization', `Bearer ${user1.token}`);

        const roomCode = roomResponse.body.data.room.code;
        const roomId = roomResponse.body.data.room.id;

        await request(API_URL)
            .post(`/api/rooms/${roomCode}/join`)
            .set('Authorization', `Bearer ${user2.token}`);

        console.log('✓ Room created and both players joined');

        // Player 2 tries to move (but it's Player 1's turn)
        const wrongTurnResponse = await request(API_URL)
            .post(`/api/game/${roomId}/move`)
            .set('Authorization', `Bearer ${user2.token}`)
            .send({ position: 0 });

        if (wrongTurnResponse.status === 400 && wrongTurnResponse.body.error.includes('not your turn')) {
            console.log('✅ PASS: Wrong turn correctly rejected');
            return true;
        } else {
            console.log('❌ FAIL: Wrong turn was not rejected');
            return false;
        }
    } catch (error) {
        console.error('Test error:', error);
        return false;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           CONCURRENCY TEST SUITE                           ║');
    console.log('║      Testing Race Condition Handling                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nTarget API: ${API_URL}`);

    const results = {
        simultaneousMoves: await testSimultaneousMoves(),
        roomJoinRace: await testRoomJoinRace(),
        wrongTurn: await testWrongTurn()
    };

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');

    let passed = 0;
    let failed = 0;

    for (const [testName, result] of Object.entries(results)) {
        const status = result ? '✅ PASS' : '❌ FAIL';
        console.log(`║  ${testName.padEnd(40)} ${status}   ║`);
        if (result) passed++;
        else failed++;
    }

    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Total: ${passed} passed, ${failed} failed                             ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');

    process.exit(failed > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testSimultaneousMoves, testRoomJoinRace, testWrongTurn };
