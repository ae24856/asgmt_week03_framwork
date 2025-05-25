const input = document.querySelector('#input');
const btn = document.querySelector('#btn');
const result = document.querySelector('#result');

btn.addEventListener('click', async () => {
  const data = { num: input.value };
  const res = await fetch('/api/echo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  result.textContent = JSON.stringify(json, null, 2);
});

