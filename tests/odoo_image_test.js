// Odoo Image Handling Test Script
// Run with: node odoo_image_test.js
// This script focuses on image upload, download, and thumbnail creation

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const readline = require('readline');

// Configuration
const config = {
  baseURL: 'https://stairmaster18.odoo-sandbox.com',
  db: 'STAIRMASTER_18_24032025',
  username: 'ptadmin',
  password: '++Uke52br++',
  clientId: 'ZqUAbvS6PIcOobKIjz4G4OuaKgm6pK9cpcpxBz1p',
  clientSecret: 'ZDfR6WHORSfrGSl424G9zNu5yXhfle6PRMGpC69M'
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to get user input
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Global access token
let accessToken = null;

// Create output directories if they don't exist
const setupDirectories = () => {
  const dirs = ['downloads', 'downloads/thumbnails', 'downloads/originals'];
  dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  });
};

// Format JSON output
const formatJSON = (data) => JSON.stringify(data, null, 2);

// Get OAuth token
const getAuthToken = async () => {
  try {
    console.log('Requesting OAuth token...');
    const tokenUrl = `${config.baseURL}/api/v2/authentication/oauth2/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', config.username);
    params.append('password', config.password);
    params.append('client_id', config.clientId);
    params.append('client_secret', config.clientSecret);

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data && response.data.access_token) {
      console.log('✅ Authentication successful');
      console.log(`Token: ${response.data.access_token.substring(0, 10)}...`);
      return response.data.access_token;
    } else {
      console.error('❌ Authentication failed: No access token in response');
      console.log('Response:', formatJSON(response.data));
      return null;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    if (error.response) {
      console.error('Error response:', formatJSON(error.response.data));
    }
    return null;
  }
};

// Make API request with proper headers
const makeApiRequest = async (method, endpoint, params = null, data = null, requestConfig = {}) => {
  if (!accessToken) {
    console.error('No access token available. Please authenticate first.');
    return null;
  }

  try {
    const url = `${config.baseURL}${endpoint}`;
    console.log(`\n🔄 Making ${method.toUpperCase()} request to: ${url}`);
    
    if (params) console.log('Params:', formatJSON(params));
    if (data && !(data instanceof FormData)) console.log('Data:', formatJSON(data));

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'DATABASE': config.db,
      'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json'
    };

    const finalConfig = {
      method,
      url,
      headers,
      ...requestConfig
    };

    if (params) finalConfig.params = params;
    if (data) finalConfig.data = data;

    const response = await axios(finalConfig);
    console.log(`✅ Request successful (${response.status})`);
    return response.data;
  } catch (error) {
    console.error(`❌ API request error: ${error.message}`);
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error('Error response:', error.response.data);
    }
    return null;
  }
};

// Helper function to get all attachments for a partner
async function getPartnerAttachments(partnerId) {
  // Step 1: Get messages related to this partner
  console.log('\n📋 Step 1: Getting messages related to this partner');
  const messagesData = await makeApiRequest('post', '/api/v2/call', null, {
    model: 'mail.message',
    method: 'search_read',
    args: [
      [
        ['model', '=', 'res.partner'],
        ['res_id', '=', partnerId]
      ]
    ],
    kwargs: {
      fields: ['id', 'attachment_ids', 'body', 'date', 'author_id']
    }
  });

  if (!messagesData) {
    console.error('❌ Failed to get messages for partner');
    return null;
  }

  console.log(`✅ Found ${messagesData.length} messages for partner ID ${partnerId}`);

  // Extract attachment IDs from messages
  let messageAttachmentIds = [];
  messagesData.forEach(msg => {
    if (msg.attachment_ids && Array.isArray(msg.attachment_ids) && msg.attachment_ids.length > 0) {
      messageAttachmentIds = [...messageAttachmentIds, ...msg.attachment_ids];
    }
  });

  console.log(`✅ Found ${messageAttachmentIds.length} attachment IDs in messages`);

  // Step 2: Get direct attachments for this partner
  console.log('\n📋 Step 2: Getting direct attachments for this partner');
  const directAttachmentsData = await makeApiRequest('post', '/api/v2/call', null, {
    model: 'ir.attachment',
    method: 'search_read',
    args: [
      [
        ['res_model', '=', 'res.partner'],
        ['res_id', '=', partnerId]
      ]
    ],
    kwargs: {
      fields: ['id']
    }
  });

  if (!directAttachmentsData) {
    console.error('❌ Failed to get direct attachments for partner');
    // Continue with message attachments if available
  } else {
    console.log(`✅ Found ${directAttachmentsData.length} direct attachments for partner ID ${partnerId}`);
  }

  // Extract direct attachment IDs
  const directAttachmentIds = directAttachmentsData ? directAttachmentsData.map(att => att.id) : [];

  // Combine all attachment IDs and remove duplicates
  const allAttachmentIds = [...new Set([...messageAttachmentIds, ...directAttachmentIds])];
  console.log(`✅ Total unique attachments: ${allAttachmentIds.length}`);

  if (allAttachmentIds.length === 0) {
    console.log('❌ No attachments found for this partner');
    return [];
  }

  // Step 3: Get detailed information for all attachments
  console.log('\n📋 Step 3: Getting detailed information for all attachments');
  const attachmentsData = await makeApiRequest('post', '/api/v2/call', null, {
    model: 'ir.attachment',
    method: 'search_read',
    args: [
      [
        ['id', 'in', allAttachmentIds]
      ]
    ],
    kwargs: {
      fields: ['id', 'name', 'mimetype', 'file_size', 'create_date', 'create_uid', 'res_model', 'res_id', 'type', 'url']
    }
  });

  if (!attachmentsData) {
    console.error('❌ Failed to get attachment details');
    return null;
  }

  console.log(`✅ Retrieved details for ${attachmentsData.length} attachments`);

  return attachmentsData;
}

// Image specific functions
const imageHandler = {
  // Get all images for a partner
  getPartnerImages: async (partnerId) => {
    console.log(`\n===== Finding Images for Partner ID: ${partnerId} =====`);
    
    // First get partner details to check for profile image
    const partnerData = await makeApiRequest('get', '/api/v2/read/res.partner', {
      ids: JSON.stringify([partnerId]),
      fields: JSON.stringify(['name', 'email', 'phone', 'image_128', 'image_1920'])
    });
    
    if (!partnerData) {
      console.error('❌ Failed to get partner details');
      return null;
    }
    
    console.log(`✅ Partner found: ${partnerData.name}`);
    console.log(`Email: ${partnerData.email || 'Not available'}`);
    console.log(`Phone: ${partnerData.phone || 'Not available'}`);
    
    // Check for profile images
    const hasProfileImage = partnerData.image_128 || partnerData.image_1920;
    console.log(`Profile image: ${hasProfileImage ? 'Present' : 'Not present'}`);
    
    // Get attachments - both from messages and direct attachments
    const attachments = await getPartnerAttachments(partnerId);
    
    if (!attachments || attachments.length === 0) {
      console.log('❌ No attachments found');
      
      // Even if no attachments, we might still have a profile image
      if (hasProfileImage) {
        return {
          profileImage: {
            exists: true,
            partnerId: partnerId,
            partnerName: partnerData.name
          },
          imageAttachments: [],
          otherAttachments: []
        };
      }
      
      return null;
    }
    
    // Filter for image attachments
    const imageAttachments = attachments.filter(att => 
      att.mimetype && att.mimetype.startsWith('image/')
    );
    
    // Filter for non-image attachments
    const otherAttachments = attachments.filter(att => 
      !att.mimetype || !att.mimetype.startsWith('image/')
    );
    
    console.log(`✅ Found ${imageAttachments.length} image attachments`);
    console.log(`✅ Found ${otherAttachments.length} non-image attachments`);
    
    return {
      profileImage: {
        exists: hasProfileImage,
        partnerId: partnerId,
        partnerName: partnerData.name,
        partnerDetails: partnerData
      },
      imageAttachments: imageAttachments,
      otherAttachments: otherAttachments
    };
  },
  
  // Download profile image with specified size
  downloadProfileImage: async (partnerId, size = '128x128') => {
    console.log(`\n===== Downloading Profile Image for Partner ID: ${partnerId} (Size: ${size}) =====`);
    
    // First check if partner exists and has an image
    const partnerData = await makeApiRequest('get', '/api/v2/read/res.partner', {
      ids: JSON.stringify([partnerId]),
      fields: JSON.stringify(['name', 'image_128'])
    });
    
    if (!partnerData) {
      console.error('❌ Failed to get partner details');
      return null;
    }
    
    if (!partnerData.image_128) {
      console.log('❌ Partner has no profile image');
      return null;
    }
    
    console.log(`✅ Partner found: ${partnerData.name} (with profile image)`);
    
    // Create filename based on partner and size
    const safeName = partnerData.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `profile_${partnerId}_${safeName}_${size}.jpg`;
    const filepath = path.join(process.cwd(), 'downloads/thumbnails', filename);
    
    // Generate URL to download the image at requested size
    const imageUrl = `/api/v2/image/res.partner/${partnerId}/image_1920/${size}`;
    
    try {
      console.log(`Downloading from: ${imageUrl}`);
      
      const response = await axios({
        method: 'get',
        url: `${config.baseURL}${imageUrl}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'DATABASE': config.db
        },
        responseType: 'arraybuffer'
      });
      
      // Save the image
      fs.writeFileSync(filepath, Buffer.from(response.data));
      
      console.log(`✅ Image saved to: ${filepath}`);
      console.log(`Size: ${Math.round(response.data.length / 1024)} KB`);
      
      return {
        path: filepath,
        size: response.data.length,
        partnerId: partnerId,
        partnerName: partnerData.name
      };
    } catch (error) {
      console.error(`❌ Failed to download profile image: ${error.message}`);
      return null;
    }
  },
  
  // Download an attachment image with optional resizing
  downloadAttachmentImage: async (attachmentId, targetSize = null) => {
    console.log(`\n===== Downloading Attachment Image ID: ${attachmentId} =====`);
    
    // Get attachment details first
    const attachmentData = await makeApiRequest('post', '/api/v2/call', null, {
      model: 'ir.attachment',
      method: 'search_read',
      args: [
        [
          ['id', '=', attachmentId]
        ]
      ],
      kwargs: {
        fields: ['id', 'name', 'mimetype', 'file_size', 'type']
      }
    });
    
    if (!attachmentData || !attachmentData.length) {
      console.error('❌ Failed to get attachment details');
      return null;
    }
    
    const attachment = attachmentData[0];
    console.log(`✅ Attachment found: ${attachment.name}`);
    
    // Determine best URL format for downloading
    let downloadUrl;
    let isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');
    
    // If it's an image and a specific size is requested, try to use the image endpoint
    if (isImage && targetSize) {
      downloadUrl = `/api/v2/image/${attachmentId}/${targetSize}`;
    } else {
      // Otherwise use the standard download endpoint
      downloadUrl = `/api/v2/download/${attachmentId}`;
    }
    
    try {
      console.log(`Downloading from: ${downloadUrl}`);
      
      const response = await axios({
        method: 'get',
        url: `${config.baseURL}${downloadUrl}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'DATABASE': config.db
        },
        responseType: 'arraybuffer'
      });
      
      // Create filename
      const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const sizeTag = targetSize ? `_${targetSize}` : '';
      const filename = `attachment_${attachmentId}${sizeTag}_${safeName}`;
      
      // Determine the proper directory based on whether this is a thumbnail or not
      const subdir = isImage && targetSize ? 'thumbnails' : 'originals';
      const filepath = path.join(process.cwd(), `downloads/${subdir}`, filename);
      
      // Save the file
      fs.writeFileSync(filepath, Buffer.from(response.data));
      
      console.log(`✅ File saved to: ${filepath}`);
      console.log(`Size: ${Math.round(response.data.length / 1024)} KB`);
      
      return {
        path: filepath,
        size: response.data.length,
        attachmentId: attachmentId,
        targetSize: targetSize
      };
    } catch (error) {
      console.error(`❌ Failed to download attachment: ${error.message}`);
      return null;
    }
  },
  
  // Download all images for a partner with thumbnails
  downloadAllPartnerImages: async (partnerId) => {
    console.log(`\n===== Downloading All Images for Partner ID: ${partnerId} =====`);
    
    // Get all images for the partner
    const imageData = await imageHandler.getPartnerImages(partnerId);
    
    if (!imageData) {
      console.error('❌ Failed to get image data');
      return null;
    }
    
    const results = {
      profileImage: null,
      attachments: []
    };
    
    // Download profile image if it exists
    if (imageData.profileImage && imageData.profileImage.exists) {
      console.log('\n📋 Downloading profile image...');
      
      // Get different sizes
      const sizes = ['64x64', '128x128', '256x256'];
      results.profileImage = [];
      
      for (const size of sizes) {
        const profileImage = await imageHandler.downloadProfileImage(partnerId, size);
        if (profileImage) {
          results.profileImage.push({
            size: size,
            path: profileImage.path,
            fileSize: profileImage.size
          });
        }
      }
    }
    
    // Download all image attachments
    if (imageData.imageAttachments && imageData.imageAttachments.length > 0) {
      console.log(`\n📋 Downloading ${imageData.imageAttachments.length} image attachments...`);
      
      for (const attachment of imageData.imageAttachments) {
        console.log(`\nProcessing attachment: ${attachment.name} (ID: ${attachment.id})`);
        
        // First get the original
        const original = await imageHandler.downloadAttachmentImage(attachment.id);
        
        if (original) {
          const attachmentResult = {
            id: attachment.id,
            name: attachment.name,
            original: {
              path: original.path,
              fileSize: original.size
            },
            thumbnails: []
          };
          
          // Now get thumbnails in different sizes
          const sizes = ['64x64', '128x128', '256x256'];
          
          for (const size of sizes) {
            const thumbnail = await imageHandler.downloadAttachmentImage(attachment.id, size);
            
            if (thumbnail) {
              attachmentResult.thumbnails.push({
                size: size,
                path: thumbnail.path,
                fileSize: thumbnail.size
              });
            }
          }
          
          results.attachments.push(attachmentResult);
        }
      }
    }
    
    // Download all other attachments
    if (imageData.otherAttachments && imageData.otherAttachments.length > 0) {
      console.log(`\n📋 Downloading ${imageData.otherAttachments.length} non-image attachments...`);
      
      for (const attachment of imageData.otherAttachments) {
        console.log(`\nProcessing attachment: ${attachment.name} (ID: ${attachment.id})`);
        
        // Download the file
        await imageHandler.downloadAttachmentImage(attachment.id);
      }
    }
    
    console.log('\n===== Download Complete =====');
    console.log(`Profile Images: ${results.profileImage ? results.profileImage.length : 0}`);
    console.log(`Attachment Images: ${results.attachments.length}`);
    console.log(`Other Attachments: ${imageData.otherAttachments.length}`);
    
    return results;
  }
};

// Function to search for partners
async function searchPartners(searchTerm) {
  console.log(`\n===== Searching for partners matching: "${searchTerm}" =====`);
  
  const domain = searchTerm ? 
    JSON.stringify([
      '|', '|', '|',
      ['name', 'ilike', searchTerm],
      ['email', 'ilike', searchTerm],
      ['phone', 'ilike', searchTerm],
      ['mobile', 'ilike', searchTerm]
    ]) : 
    JSON.stringify([]);
  
  const params = {
    domain: domain,
    fields: JSON.stringify(['id', 'name', 'email', 'phone', 'mobile', 'is_company']),
    limit: 10,
    offset: 0
  };
  
  const data = await makeApiRequest('get', '/api/v2/search_read/res.partner', params);
  
  if (!data || !data.length) {
    console.log('❌ No partners found matching your search');
    return [];
  }
  
  console.log(`✅ Found ${data.length} matching partners`);
  return data;
}

// Display search results in a table format
function displayPartners(partners) {
  if (!partners || partners.length === 0) {
    return;
  }
  
  console.log('\n===== Partner Search Results =====');
  console.log('ID\t| Type\t| Name\t\t\t| Email\t\t\t| Phone');
  console.log('-'.repeat(80));
  
  partners.forEach(partner => {
    const id = partner.id.toString().padEnd(5);
    const type = partner.is_company ? 'Comp' : 'Indv';
    const name = (partner.name || '').padEnd(20).substring(0, 20);
    const email = (partner.email || '').padEnd(20).substring(0, 20);
    const phone = partner.phone || partner.mobile || '';
    
    console.log(`${id}\t| ${type}\t| ${name}\t| ${email}\t| ${phone}`);
  });
}

// Main menu function
async function showMenu() {
  console.log('\n===== Odoo Image & Attachment Tool =====');
  console.log('1. Authenticate (get token)');
  console.log('2. Search for partners');
  console.log('3. Get partner details by ID');
  console.log('4. Download profile image');
  console.log('5. Download all partner attachments with thumbnails');
  console.log('6. Download specific attachment by ID');
  console.log('0. Exit');

  const choice = await askQuestion('\nEnter your choice: ');

  switch (choice) {
    case '1':
      accessToken = await getAuthToken();
      break;
    case '2':
      const searchTerm = await askQuestion('Enter search term (name, email, phone): ');
      const partners = await searchPartners(searchTerm);
      displayPartners(partners);
      break;
    case '3':
      const partnerId = await askQuestion('Enter partner ID: ');
      await imageHandler.getPartnerImages(parseInt(partnerId));
      break;
    case '4':
      const profilePartnerId = await askQuestion('Enter partner ID: ');
      const size = await askQuestion('Enter size (e.g., 64x64, 128x128, 256x256): ');
      await imageHandler.downloadProfileImage(parseInt(profilePartnerId), size);
      break;
    case '5':
      const downloadPartnerId = await askQuestion('Enter partner ID: ');
      await imageHandler.downloadAllPartnerImages(parseInt(downloadPartnerId));
      break;
    case '6':
      const attachmentId = await askQuestion('Enter attachment ID: ');
      const wantThumbnails = await askQuestion('Download thumbnails for images? (y/n): ');
      
      if (wantThumbnails.toLowerCase() === 'y') {
        // Download original first
        const original = await imageHandler.downloadAttachmentImage(parseInt(attachmentId));
        
        // If it's an image, also download thumbnails
        if (original) {
          const attachmentData = await makeApiRequest('post', '/api/v2/call', null, {
            model: 'ir.attachment',
            method: 'search_read',
            args: [
              [
                ['id', '=', parseInt(attachmentId)]
              ]
            ],
            kwargs: {
              fields: ['mimetype']
            }
          });
          
          if (attachmentData && attachmentData.length && 
              attachmentData[0].mimetype && 
              attachmentData[0].mimetype.startsWith('image/')) {
            // Download thumbnails
            await imageHandler.downloadAttachmentImage(parseInt(attachmentId), '64x64');
            await imageHandler.downloadAttachmentImage(parseInt(attachmentId), '128x128');
            await imageHandler.downloadAttachmentImage(parseInt(attachmentId), '256x256');
          }
        }
      } else {
        // Just download the original
        await imageHandler.downloadAttachmentImage(parseInt(attachmentId));
      }
      break;
    case '0':
      console.log('Exiting...');
      rl.close();
      return false;
    default:
      console.log('Invalid choice, please try again.');
  }
  return true;
}

// Main function
async function main() {
  try {
    // Setup directories
    setupDirectories();
    
    console.log('📱 ExoMobile Odoo Image & Attachment Tool 📱');
    console.log('This tool helps download images and attachments from Odoo API.');
    
    let continueRunning = true;
    while (continueRunning) {
      continueRunning = await showMenu();
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
    rl.close();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
});
