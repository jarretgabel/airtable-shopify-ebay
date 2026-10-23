import {
  createConfiguredRecord,
  deleteConfiguredRecord,
  getConfiguredFieldMetadata,
  getConfiguredRecord,
  getConfiguredRecords,
  getConfiguredRecordsSummary,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '../providers/airtable/sources.js';
import type { ListingStore } from './listingStore.js';

export const airtableListingStore: ListingStore = {
  getRecords: getConfiguredRecords,
  getRecordsSummary: getConfiguredRecordsSummary,
  getRecord: getConfiguredRecord,
  createRecord: createConfiguredRecord,
  updateRecord: updateConfiguredRecord,
  deleteRecord: deleteConfiguredRecord,
  getFieldMetadata: getConfiguredFieldMetadata,
  uploadAttachment: uploadConfiguredAttachment,
};
