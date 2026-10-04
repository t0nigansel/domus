import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../utils/api';

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should be defined', () => {
    expect(api).toBeDefined();
    expect(typeof api).toBe('object');
  });

  describe('GET', () => {
    it('should handle successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await api.get('/test');
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith('/api/test');
    });

    it('should throw error when GET request fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(api.get('/test')).rejects.toThrow('API call failed: Not Found');
    });
  });

  describe('POST', () => {
    it('should handle successful POST request', async () => {
      const mockData = { id: 1, name: 'Test' };
      const postData = { name: 'Test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await api.post('/test', postData);
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });
    });
  });

  describe('PUT', () => {
    it('should handle successful PUT request', async () => {
      const mockData = { id: 1, name: 'Updated' };
      const putData = { name: 'Updated' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await api.put('/test/1', putData);
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(putData)
      });
    });
  });

  describe('DELETE', () => {
    it('should handle successful DELETE request', async () => {
      const mockData = { success: true };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await api.delete('/test/1');
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'DELETE'
      });
    });
  });
});
