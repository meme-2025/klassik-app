const { Client } = require('@kaspa/grpc-node');

console.log('Creating gRPC client...');
const client = new Client({
    host: '127.0.0.1:16110',
    reconnect: false,
    verbose: true
});

console.log('Connecting to kaspad...');
client.connect()
    .then(() => {
        console.log('✅ Connected! Testing getBlockDagInfoRequest...');
        return client.call('getBlockDagInfoRequest', {});
    })
    .then(info => {
        console.log('✅ Success!');
        console.log(JSON.stringify(info, null, 2));
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    });
