import { getCurrentUser, getUserPreferences, updateUserPreferences } from '../../src/api/models/usersApi';
import { getUser, getSession } from '../../src/api/odooClient';

// Mock the dependencies
jest.mock('../../src/api/odooClient', () => ({
  getUser: jest.fn(),
  getSession: jest.fn(),
}));

jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('usersApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('should return user data from getUser if available', async () => {
      const mockUserData = { id: 1, name: 'Test User', email: 'test@example.com' };
      getUser.mockResolvedValueOnce(mockUserData);

      const result = await getCurrentUser();

      expect(result).toEqual(mockUserData);
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(getSession).not.toHaveBeenCalled();
    });

    it('should fall back to session and getById if getUser returns null', async () => {
      getUser.mockResolvedValueOnce(null);
      const mockSession = { uid: 2 };
      getSession.mockResolvedValueOnce(mockSession);

      // Mock the usersAPI.getById method
      const mockUserData = { id: 2, name: 'Session User', email: 'session@example.com' };
      jest.spyOn(require('../../src/api/models/usersApi').usersAPI, 'getById').mockResolvedValueOnce(mockUserData);

      const result = await getCurrentUser();

      expect(result).toEqual(mockUserData);
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(getSession).toHaveBeenCalledTimes(1);
    });

    it('should return null if both methods fail', async () => {
      getUser.mockResolvedValueOnce(null);
      getSession.mockResolvedValueOnce(null);

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(getSession).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      getUser.mockRejectedValueOnce(new Error('API error'));

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(getUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserPreferences', () => {
    it('should call the correct method with the right parameters', async () => {
      const mockPreferences = { lang: 'en_US', tz: 'UTC' };
      jest.spyOn(require('../../src/api/models/usersApi').usersAPI, 'callMethod').mockResolvedValueOnce(mockPreferences);

      const result = await getUserPreferences(1);

      expect(result).toEqual(mockPreferences);
      expect(require('../../src/api/models/usersApi').usersAPI.callMethod).toHaveBeenCalledWith(1, 'read_preferences', [], {});
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(require('../../src/api/models/usersApi').usersAPI, 'callMethod').mockRejectedValueOnce(new Error('API error'));

      const result = await getUserPreferences(1);

      expect(result).toBeNull();
    });
  });

  describe('updateUserPreferences', () => {
    it('should call the correct method with the right parameters', async () => {
      const mockPreferences = { lang: 'fr_FR', tz: 'Europe/Paris' };
      jest.spyOn(require('../../src/api/models/usersApi').usersAPI, 'callMethod').mockResolvedValueOnce(true);

      const result = await updateUserPreferences(1, mockPreferences);

      expect(result).toBe(true);
      expect(require('../../src/api/models/usersApi').usersAPI.callMethod).toHaveBeenCalledWith(1, 'write_preferences', [], mockPreferences);
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(require('../../src/api/models/usersApi').usersAPI, 'callMethod').mockRejectedValueOnce(new Error('API error'));

      const result = await updateUserPreferences(1, {});

      expect(result).toBe(false);
    });
  });
});
