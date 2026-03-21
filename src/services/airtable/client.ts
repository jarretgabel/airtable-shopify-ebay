import axios, { AxiosInstance } from 'axios';

export function createAirtableClient(apiKey: string, baseId: string): AxiosInstance {
  return axios.create({
    baseURL: `https://api.airtable.com/v0/${baseId}`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}