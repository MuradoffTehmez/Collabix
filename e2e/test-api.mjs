import fs from 'fs';

async function test() {
  const res = await fetch('http://127.0.0.1:8788/api/teams/e2e-alpha-team/members', {
    headers: {
      'Cookie': 'collabix_sid=abc'
    }
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
