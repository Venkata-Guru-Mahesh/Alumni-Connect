import { useState, useRef, useEffect } from 'react';
import { FiUpload, FiFile, FiX, FiCheck, FiAlertCircle, FiImage } from 'react-icons/fi';
import axiosInstance from '../../api/axiosInstance';

const FileUpload = ({
  accept = '*',
  maxSize = 5, // MB
  label = 'Upload File',
  onChange,
  value,
  error,
  helperText,
  showPreview = true,
  disabled = false,
  icon: CustomIcon,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [preview, setPreview] = useState(value || null);
  const fileInputRef = useRef(null);

  // Sync preview with value prop changes
  useEffect(() => {
    // Only update if value is different and not empty
    // This prevents clearing preview when parent re-renders
    if (value && value !== preview) {
      setPreview(value);
    }
  }, [value]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const validateFile = (file) => {
    // Check file size
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${maxSize}MB`;
    }

    // Check file type if accept is specified
    if (accept !== '*') {
      const acceptedTypes = accept.split(',').map(t => t.trim());
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      const mimeType = file.type;
      
      const isValid = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase();
        }
        return mimeType.match(new RegExp(type.replace('*', '.*')));
      });

      if (!isValid) {
        return `File type not supported. Accepted: ${accept}`;
      }
    }

    return null;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);

    try {
      // Upload to Cloudinary via backend API (don't show local preview to avoid race condition)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'alumni-connect/profiles');
      
      const response = await axiosInstance.post('/upload/image/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for image uploads
      });

      // Backend already unwraps response due to interceptor
      // response.data contains {url, public_id, width, height, format}
      const uploadedUrl = response.data.url;
      
      console.log('Upload successful:', uploadedUrl);
      
      // Update preview with uploaded URL (this will persist now)
      setPreview(uploadedUrl);

      // Call onChange with the uploaded URL
      if (onChange) {
        onChange(uploadedUrl);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.error || error.message || 'Failed to upload file');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async () => {
    try {
      // Fetch the PDF through our backend proxy (bypasses Cloudinary ACL/referrer restrictions).
      // We can't use window.open with a custom Authorization header, so we fetch as blob
      // and create a temporary object URL that the browser can open directly.
      const resp = await axiosInstance.get('/upload/document-proxy/', {
        params: { url: preview },
        responseType: 'blob',
      });
      const blob = new Blob([resp.data], { type: resp.headers?.['content-type'] || 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch {
      // Fallback: try direct URL
      window.open(preview, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onChange) {
      onChange(null);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const Icon = CustomIcon || FiUpload;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="space-y-3">
        {/* Upload Button */}
        {!preview && !uploading && (
          <div
            onClick={handleClick}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-primary-500 hover:bg-primary-50'}
              ${uploadError || error ? 'border-red-300 bg-red-50' : 'border-gray-300'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              disabled={disabled || uploading}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-2">
              <div className={`p-3 rounded-full ${uploadError || error ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Icon className={`w-6 h-6 ${uploadError || error ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {uploading ? 'Uploading...' : 'Click to upload'}
                </p>
                {helperText && (
                  <p className="text-xs text-gray-500 mt-1">{helperText}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Uploading State */}
        {uploading && (
          <div className="border-2 border-dashed border-primary-300 rounded-lg p-6 text-center bg-primary-50">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="text-sm font-medium text-primary-700">Uploading...</p>
              <p className="text-xs text-primary-600">Please wait</p>
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && showPreview && !uploading && (
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-start gap-3">
              {/* Image Preview vs Document Preview */}
              {typeof preview === 'string' && !preview.includes('/raw/upload/') && (preview.startsWith('data:image') || preview.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || preview.startsWith('http')) && !preview.match(/\.(pdf|doc|docx)(\?|$)/i) ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-16 h-16 rounded object-cover flex-shrink-0"
                />
              ) : (
                /* Document / File Preview */
                <div className="w-16 h-16 rounded bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                  <FiFile className="w-8 h-8 text-red-500" />
                </div>
              )}

              {/* File Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {typeof preview === 'string'
                        ? preview.includes('/raw/upload/') || preview.match(/\.(pdf|doc|docx)(\?|$)/i)
                          ? preview.split('/').pop().split('?')[0] || 'Document uploaded'
                          : 'Image uploaded'
                        : preview?.name || 'File uploaded'}
                    </p>
                    {typeof preview === 'object' && preview?.size && (
                      <p className="text-xs text-gray-500">
                        {formatFileSize(preview.size)}
                      </p>
                    )}
                    {/* View link for documents */}
                    {typeof preview === 'string' && (preview.includes('/raw/upload/') || preview.match(/\.(pdf|doc|docx)(\?|$)/i)) && (
                      <button
                        type="button"
                        onClick={handleViewDocument}
                        className="text-xs text-primary-600 hover:underline mt-1 inline-block"
                      >
                        View / Download
                      </button>
                    )}
                  </div>

                  {/* Remove Button */}
                  {!disabled && (
                    <button
                      onClick={handleRemove}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      type="button"
                    >
                      <FiX className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>

                {/* Success Indicator */}
                <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                  <FiCheck className="w-3 h-3" />
                  <span>Uploaded successfully</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {(uploadError || error) && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{uploadError || error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
