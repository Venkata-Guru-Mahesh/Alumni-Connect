"""
Cloudinary utility functions for file upload
"""
import os
import cloudinary
import cloudinary.uploader
from django.conf import settings

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
    secure=True
)


def upload_image(file, folder='alumni-connect', public_id=None, transformation=None):
    """
    Upload an image or video to Cloudinary
    
    Args:
        file: File object or file path
        folder: Cloudinary folder to store the image (default: 'alumni-connect')
        public_id: Custom public ID for the image (optional)
        transformation: Image transformation options (optional)
        
    Returns:
        dict: Cloudinary response with url, secure_url, public_id, etc.
    """
    try:
        # Detect content type
        content_type = getattr(file, 'content_type', '')
        is_video = content_type.startswith('video/')
        is_document = content_type in (
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

        if is_document:
            resource_type = 'raw'
        elif is_video:
            resource_type = 'video'
        else:
            resource_type = 'image'

        upload_options = {
            'folder': folder,
            'resource_type': resource_type,
            'type': 'upload',  # ensure public delivery (not authenticated)
        }
        if is_document:
            upload_options['access_mode'] = 'public'  # explicitly allow public access
        if not is_document:
            upload_options['quality'] = 'auto' if is_video else 'auto:good'
        if not is_document and not is_video:
            upload_options['fetch_format'] = 'auto'

        if public_id:
            upload_options['public_id'] = public_id
            upload_options['overwrite'] = True
            
        if transformation:
            upload_options['transformation'] = transformation
        elif not is_video and not is_document:
            # Default transformation for images only
            upload_options['transformation'] = [
                {'width': 1920, 'height': 1080, 'crop': 'limit'},
                {'quality': 'auto:good'},
                {'fetch_format': 'auto'}
            ]
        
        result = cloudinary.uploader.upload(file, **upload_options)
        return {
            'success': True,
            'url': result.get('secure_url'),
            'public_id': result.get('public_id'),
            'width': result.get('width'),
            'height': result.get('height'),
            'format': result.get('format'),
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def get_signed_url(url, expires_in=3600):
    """
    Generate a signed Cloudinary delivery URL.
    Required when the account has 'Signed URLs Required' or ACL restrictions.

    Args:
        url: The original Cloudinary URL (e.g. https://res.cloudinary.com/.../raw/upload/...)
        expires_in: Seconds until the signed URL expires (default: 1 hour)

    Returns:
        str: Signed URL, or original URL if parsing fails
    """
    import re
    import time
    import cloudinary.utils as cld_utils

    match = re.search(
        r'cloudinary\.com/[^/]+/(raw|image|video)/upload/(?:v\d+/)?(.+)', url
    )
    if not match:
        return url

    resource_type = match.group(1)
    public_id = match.group(2)  # includes extension, e.g. alumni-connect/profiles/file.pdf

    try:
        expiration = int(time.time()) + expires_in
        signed_url, _ = cld_utils.cloudinary_url(
            public_id,
            resource_type=resource_type,
            type='upload',
            secure=True,
            sign_url=True,
            expiration=expiration,
        )
        return signed_url
    except Exception:
        return url


def delete_image(public_id):
    """
    Delete an image from Cloudinary
    
    Args:
        public_id: Public ID of the image to delete
        
    Returns:
        dict: Cloudinary response
    """
    try:
        result = cloudinary.uploader.destroy(public_id)
        return {
            'success': result.get('result') == 'ok',
            'message': result.get('result')
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def get_image_url(public_id, transformation=None):
    """
    Get the URL for an image stored in Cloudinary
    
    Args:
        public_id: Public ID of the image
        transformation: Image transformation options (optional)
        
    Returns:
        str: Image URL
    """
    try:
        if transformation:
            return cloudinary.CloudinaryImage(public_id).build_url(transformation=transformation)
        return cloudinary.CloudinaryImage(public_id).build_url()
    except Exception as e:
        return None
