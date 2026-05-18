fetch('http://localhost:8080/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ conversationId: '123', content: 'test' })
})
  .then(async r => {
    console.log(r.status);
    console.log(await r.text());
  })
  .catch(console.error);
