import { API } from './config';
import { getValidUserToken } from './token';

export interface EbayUploadedImageResult {
  url: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getXmlText(doc: XMLDocument, tagName: string): string {
  return (
    doc.getElementsByTagNameNS('*', tagName)[0]?.textContent?.trim()
    ?? doc.getElementsByTagName(tagName)[0]?.textContent?.trim()
    ?? ''
  );
}

function getTradingErrors(doc: XMLDocument): string {
  const errors = Array.from(doc.getElementsByTagNameNS('*', 'Errors'));
  return errors
    .map((error) => {
      const longMessage = error.getElementsByTagNameNS('*', 'LongMessage')[0]?.textContent?.trim();
      const shortMessage = error.getElementsByTagNameNS('*', 'ShortMessage')[0]?.textContent?.trim();
      const code = error.getElementsByTagNameNS('*', 'ErrorCode')[0]?.textContent?.trim();
      const message = longMessage || shortMessage || 'Unknown Trading API error';
      return code ? `${code}: ${message}` : message;
    })
    .filter(Boolean)
    .join(' | ');
}

export async function uploadImageToEbayHostedPictures(file: File): Promise<EbayUploadedImageResult> {
  const token = await getValidUserToken();
  const xmlPayload = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
    `<PictureName>${escapeXml(file.name)}</PictureName>`,
    '<PictureSet>Standard</PictureSet>',
    '</UploadSiteHostedPicturesRequest>',
  ].join('');

  const formData = new FormData();
  formData.append('XML Payload', xmlPayload);
  formData.append('image', file, file.name);

  const res = await fetch(`${API}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': 'UploadSiteHostedPictures',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1231',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-IAF-TOKEN': token,
    },
    body: formData,
  });

  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0]?.textContent?.trim();
  if (parseError) throw new Error(`UploadSiteHostedPictures XML parse error: ${parseError}`);

  const ack = getXmlText(doc, 'Ack');
  if (!res.ok || (ack && ack !== 'Success' && ack !== 'Warning')) {
    const message = getTradingErrors(doc) || text.slice(0, 400);
    throw new Error(`UploadSiteHostedPictures ${res.status}: ${message}`);
  }

  const url = getXmlText(doc, 'FullURL') || getXmlText(doc, 'PictureURL');
  if (!url) {
    throw new Error('eBay uploaded the image but did not return a hosted picture URL.');
  }

  return { url };
}