import request from 'supertest';
import app from '../app.js';

(async () => {
  try {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'account@example.com', password: 'password123' });

    console.log('status', res.status);
    console.log('body', JSON.stringify(res.body, null, 2));
  } catch (err) {
    console.error(err);
  }
})();
