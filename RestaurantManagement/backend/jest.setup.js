jest.mock('./config/db', () => require('./__tests__/helpers/mockFirestore'));

beforeEach(() => {
  jest.clearAllMocks();
});
