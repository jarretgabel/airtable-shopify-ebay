import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { fileToBase64, identifyEquipment, type EquipmentIdentification } from '@/services/equipmentAI';
import { processImage, revokeProcessedImage, type ProcessingOptions } from '@/services/imageProcessor';
import { uploadImageFile as uploadShopifyImageFile } from '@/services/app-api/shopify';
import { uploadImageToEbayHostedPictures } from '@/services/ebay/imageUpload';
import { buildImageLabSessionStats } from '@/components/imagelab/imageLabSessionStats';
import type { ImageItem } from '@/components/imagelab/types';

function disposeItemResources(item: ImageItem) {
  URL.revokeObjectURL(item.previewUrl);
  if (item.processed) revokeProcessedImage(item.processed);
}

interface UseImageLabItemsResult {
  items: ImageItem[];
  dragging: boolean;
  copyId: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  identifyItem: (id: string) => Promise<void>;
  processItem: (id: string) => Promise<void>;
  identifyAll: () => void;
  processAll: () => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  copyDetails: (id: string, ai: EquipmentIdentification) => Promise<void>;
  uploadToShopify: (id: string) => Promise<void>;
  uploadToEbay: (id: string) => Promise<void>;
  hasBusy: boolean;
  hasIdleToIdentify: boolean;
  hasItemsToProcess: boolean;
  sessionStats: ReturnType<typeof buildImageLabSessionStats>;
}

interface UseImageLabItemsOptions {
  onShopifyImagesUpdate?: (imageUrls: string[]) => void;
  onEbayImagesUpdate?: (imageUrls: string[]) => void;
}

function buildUploadFile(item: ImageItem): { file: File; assetLabel: string } {
  if (item.processed) {
    return {
      file: new File([item.processed.blob], item.processed.filename, {
        type: item.processed.blob.type || 'image/jpeg',
      }),
      assetLabel: 'Processed image',
    };
  }

  return {
    file: item.file,
    assetLabel: 'Original image',
  };
}

export function useImageLabItems(options: ProcessingOptions, imageUpdateCallbacks?: UseImageLabItemsOptions): UseImageLabItemsResult {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copyId, setCopyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const itemsRef = useRef<ImageItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach(disposeItemResources);
    };
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<ImageItem>) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const acceptedFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!acceptedFiles.length) return;

    const newItems: ImageItem[] = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
    }));

    setItems((previous) => [...previous, ...newItems]);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }, [addFiles]);

  const onFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  }, [addFiles]);

  const identifyItem = useCallback(async (id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;

    updateItem(id, { status: 'identifying', error: undefined });
    try {
      const { base64, mimeType } = await fileToBase64(item.file);
      const aiResult = await identifyEquipment(base64, mimeType);
      updateItem(id, { status: 'identified', aiResult });
    } catch (error) {
      updateItem(id, { status: 'error', error: (error as Error).message });
    }
  }, [updateItem]);

  const processItem = useCallback(async (id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;

    if (item.processed) revokeProcessedImage(item.processed);
    updateItem(id, {
      status: 'processing',
      error: undefined,
      processed: undefined,
      uploads: undefined,
    });

    try {
      const processed = await processImage(item.file, options);
      updateItem(id, { status: 'done', processed });
    } catch (error) {
      updateItem(id, { status: 'error', error: (error as Error).message });
    }
  }, [options, updateItem]);

  const identifyAll = useCallback(() => {
    items
      .filter((item) => item.status === 'idle')
      .forEach((item) => {
        void identifyItem(item.id);
      });
  }, [identifyItem, items]);

  const processAll = useCallback(() => {
    items
      .filter((item) => item.status === 'idle' || item.status === 'identified')
      .forEach((item) => {
        void processItem(item.id);
      });
  }, [items, processItem]);

  const removeItem = useCallback((id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item) disposeItemResources(item);
    setItems((previous) => previous.filter((candidate) => candidate.id !== id));
  }, [items]);

  const clearAll = useCallback(() => {
    items.forEach(disposeItemResources);
    setItems([]);
  }, [items]);

  const copyDetails = useCallback(async (id: string, ai: EquipmentIdentification) => {
    const specsText = ai.specifications && Object.keys(ai.specifications).length
      ? Object.entries(ai.specifications).map(([key, value]) => `  ${key}: ${value}`).join('\n')
      : '  N/A';

    const text = [
      `Type: ${ai.equipment_type}`,
      `Brand: ${ai.brand}`,
      `Model: ${ai.model}`,
      `Year: ${ai.year_range}`,
      `SKU: ${ai.suggested_sku}`,
      `Shopify Type: ${ai.shopify_product_type}`,
      `MSRP (new): ${ai.msrp_original || 'Unknown'}`,
      `Recent sold: ${ai.price_range_sold || 'Unknown'}`,
      '',
      'Specifications:',
      specsText,
      '',
      'Description:',
      ai.description,
      '',
      'Condition Notes:',
      ai.condition_notes,
      '',
      `Tags: ${ai.suggested_tags.join(', ')}`,
    ].join('\n');

    await navigator.clipboard.writeText(text);
    setCopyId(id);
    setTimeout(() => setCopyId(null), 1800);
  }, []);

  const uploadToShopify = useCallback(async (id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;

    const { file, assetLabel } = buildUploadFile(item);
    updateItem(id, {
      uploads: {
        ...item.uploads,
        shopify: {
          status: 'uploading',
          assetLabel,
          url: item.uploads?.shopify?.url,
        },
      },
    });

    try {
      const uploaded = await uploadShopifyImageFile(file, item.aiResult ? `${item.aiResult.brand} ${item.aiResult.model}`.trim() : file.name);
      updateItem(id, {
        uploads: {
          ...itemsRef.current.find((candidate) => candidate.id === id)?.uploads,
          shopify: {
            status: 'done',
            url: uploaded.url,
            assetLabel,
          },
        },
      });

      // After successful upload, collect all successful Shopify uploads and invoke callback
      if (imageUpdateCallbacks?.onShopifyImagesUpdate) {
        const allShopifyUrls = itemsRef.current
          .filter((item) => item.uploads?.shopify?.status === 'done' && item.uploads.shopify.url)
          .map((item) => item.uploads!.shopify!.url!)
          .filter((url): url is string => typeof url === 'string' && url.length > 0);

        if (allShopifyUrls.length > 0) {
          imageUpdateCallbacks.onShopifyImagesUpdate(allShopifyUrls);
        }
      }
    } catch (error) {
      updateItem(id, {
        uploads: {
          ...itemsRef.current.find((candidate) => candidate.id === id)?.uploads,
          shopify: {
            status: 'error',
            error: (error as Error).message,
            assetLabel,
          },
        },
      });
    }
  }, [updateItem, imageUpdateCallbacks]);

  const uploadToEbay = useCallback(async (id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;

    const { file, assetLabel } = buildUploadFile(item);
    updateItem(id, {
      uploads: {
        ...item.uploads,
        ebay: {
          status: 'uploading',
          assetLabel,
          url: item.uploads?.ebay?.url,
        },
      },
    });

    try {
      const uploaded = await uploadImageToEbayHostedPictures(file);
      updateItem(id, {
        uploads: {
          ...itemsRef.current.find((candidate) => candidate.id === id)?.uploads,
          ebay: {
            status: 'done',
            url: uploaded.url,
            assetLabel,
          },
        },
      });

      // After successful upload, collect all successful eBay uploads and invoke callback
      if (imageUpdateCallbacks?.onEbayImagesUpdate) {
        const allEbayUrls = itemsRef.current
          .filter((item) => item.uploads?.ebay?.status === 'done' && item.uploads.ebay.url)
          .map((item) => item.uploads!.ebay!.url!)
          .filter((url): url is string => typeof url === 'string' && url.length > 0);

        if (allEbayUrls.length > 0) {
          imageUpdateCallbacks.onEbayImagesUpdate(allEbayUrls);
        }
      }
    } catch (error) {
      updateItem(id, {
        uploads: {
          ...itemsRef.current.find((candidate) => candidate.id === id)?.uploads,
          ebay: {
            status: 'error',
            error: (error as Error).message,
            assetLabel,
          },
        },
      });
    }
  }, [updateItem, imageUpdateCallbacks]);

  const sessionStats = useMemo(() => buildImageLabSessionStats(items), [items]);
  const hasBusy = items.some((item) => item.status === 'identifying' || item.status === 'processing');
  const hasIdleToIdentify = items.some((item) => item.status === 'idle');
  const hasItemsToProcess = items.some((item) => item.status === 'idle' || item.status === 'identified');

  return {
    items,
    dragging,
    copyId,
    fileInputRef,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileChange,
    identifyItem,
    processItem,
    identifyAll,
    processAll,
    removeItem,
    clearAll,
    copyDetails,
    uploadToShopify,
    uploadToEbay,
    hasBusy,
    hasIdleToIdentify,
    hasItemsToProcess,
    sessionStats,
  };
}