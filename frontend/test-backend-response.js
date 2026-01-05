// Quick test to see backend response structure
fetch('https://klassik.99pace.space/api/kaspa-enhanced/stats')
    .then(r => r.json())
    .then(data => {
        console.log('=== BACKEND STATS RESPONSE ===');
        console.log('Full response:', data);
        console.log('\n=== PRICE FIELD ===');
        console.log('data.price:', data.price);
        console.log('typeof:', typeof data.price);
        console.log('keys:', data.price ? Object.keys(data.price) : 'null');
        console.log('\n=== MARKETCAP FIELD ===');
        console.log('data.marketCap:', data.marketCap);
        console.log('data.marketcap:', data.marketcap);
        console.log('\n=== EXPECTED FIELDS ===');
        console.log('data.price?.usd:', data.price?.usd);
        console.log('data.price?.price:', data.price?.price);
        console.log('data.price?.kaspa:', data.price?.kaspa);
    })
    .catch(err => console.error('Error:', err));
