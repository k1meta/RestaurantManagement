const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../../middleware/auth');
const { JWT_SECRET } = require('../../config/auth');
const { buildDefaultSeed, userPayload } = require('../helpers/fixtures');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('auth middleware', () => {
  test('MW-01 accepts valid Bearer token', () => {
    const user = buildDefaultSeed().users[0];
    const token = jwt.sign(userPayload(user), JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.email).toBe(user.email);
  });

  test('MW-02 rejects missing Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('MW-03 rejects malformed scheme', () => {
    const req = { headers: { authorization: 'Token abc' } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('MW-04 rejects invalid JWT', () => {
    const req = { headers: { authorization: 'Bearer not-a-valid-jwt' } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('MW-05 authorize allows matching role', () => {
    const req = { user: { role: 'owner' } };
    const res = mockRes();
    const next = jest.fn();

    authorize('owner')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('MW-06 authorize denies wrong role', () => {
    const req = { user: { role: 'waiter' } };
    const res = mockRes();
    const next = jest.fn();

    authorize('owner')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('owner') })
    );
  });
});
