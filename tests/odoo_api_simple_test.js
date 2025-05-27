
// Odoo API Simple Test Script
// Run with: node odoo_api_simple_test.js

const axios = require('axios');
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

// Global access token
let accessToken = null;

// Helper function to get user input
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

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
const makeApiRequest = async (method, endpoint, params = null, data = null) => {
  if (!accessToken) {
    console.error('No access token available. Please authenticate first.');
    return null;
  }

  try {
    const url = `${config.baseURL}${endpoint}`;
    console.log(`\n🔄 Making ${method.toUpperCase()} request to: ${url}`);
    if (params) console.log('Params:', formatJSON(params));
    if (data) console.log('Data:', formatJSON(data));

    const requestConfig = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'DATABASE': config.db,
        'Content-Type': 'application/json'
      }
    };

    if (params) requestConfig.params = params;
    if (data) requestConfig.data = data;

    const response = await axios(requestConfig);
    console.log(`✅ Request successful (${response.status})`);
    return response.data;
  } catch (error) {
    console.error(`❌ API request error: ${error.message}`);
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error('Error response:', formatJSON(error.response.data));
    }
    return null;
  }
};

// Test specific endpoints
const testEndpoints = {
  // User info
  user: async () => {
    const data = await makeApiRequest('get', '/api/v2/user');
    console.log('User info:', formatJSON(data));
    return data;
  },

  // Get partner IDs
  getPartnerIds: async (limit = 10) => {
    const params = {
      domain: JSON.stringify([]),
      limit,
      offset: 0
    };
    const data = await makeApiRequest('get', '/api/v2/search/res.partner', params);
    console.log(`Partner IDs (${data ? data.length : 0}):`, formatJSON(data));
    return data;
  },

  // Get single partner by ID
  getPartnerById: async (id) => {
    const params = {
      ids: JSON.stringify([id]),
      fields: JSON.stringify(['name', 'id', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company'])
    };
    const data = await makeApiRequest('get', '/api/v2/read/res.partner', params);
    console.log('Partner details:', formatJSON(data));
    return data;
  },

  // Try search_read with single ID
  searchReadSingleId: async (id) => {
    const params = {
      domain: JSON.stringify([['id', '=', id]]),
      fields: JSON.stringify(['name', 'id', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company']),
      limit: 1
    };
    const data = await makeApiRequest('get', '/api/v2/search_read/res.partner', params);
    console.log('Search_read single result:', formatJSON(data));
    return data;
  },

  // Try search_read with multiple IDs - this is the problematic one
  searchReadMultipleIds: async (ids) => {
    const params = {
      domain: JSON.stringify([['id', 'in', ids]]),
      fields: JSON.stringify(['name', 'id', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company']),
      limit: ids.length
    };
    const data = await makeApiRequest('get', '/api/v2/search_read/res.partner', params);
    console.log(`Search_read multiple results (${data ? data.length : 0}):`, formatJSON(data));
    return data;
  },

  // Try using search_extract
  searchExtract: async (limit = 10) => {
    const data = await makeApiRequest('get', `/api/v2/search_extract/res.partner/${limit}/0/id`);
    console.log(`Search_extract results (${data ? data.length : 0}):`, formatJSON(data));
    return data;
  },

  // Use RPC call method
  rpcCall: async (ids) => {
    const data = await makeApiRequest('post', '/api/v2/call', null, {
      model: 'res.partner',
      method: 'read',
      args: [ids, ['name', 'id', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company']],
      kwargs: {}
    });
    console.log(`RPC call results:`, formatJSON(data));
    return data;
  },

  // Get all attachments for a partner
  getPartnerAttachments: async (partnerId) => {
    console.log(`\n===== Testing Attachment Retrieval for Partner ID: ${partnerId} =====`);

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

    // Process attachments to include download URLs
    const processedAttachments = attachmentsData.map(att => {
      // Construct the download URL using the preferred file storage method
      const downloadUrl = `/api/v2/download?model=ir.attachment&id=${att.id}&field=raw&filename_field=name&type=file`;

      // Also provide a fallback URL format
      const fallbackUrl = `/api/v2/download/${att.id}/${encodeURIComponent(att.name || `File-${att.id}`)}`;

      return {
        ...att,
        downloadUrl,
        fallbackUrl,
        fullDownloadUrl: `${config.baseURL}${downloadUrl}`,
        fullFallbackUrl: `${config.baseURL}${fallbackUrl}`
      };
    });

    console.log('\n===== Attachment Details =====');
    processedAttachments.forEach((att, index) => {
      console.log(`\nAttachment #${index + 1}:`);
      console.log(`Name: ${att.name || `File-${att.id}`}`);
      console.log(`ID: ${att.id}`);
      console.log(`Type: ${att.mimetype || 'Unknown'}`);
      console.log(`Size: ${att.file_size ? `${Math.round(att.file_size / 1024)} KB` : 'Unknown'}`);
      console.log(`Created: ${att.create_date}`);
      console.log(`Download URL: ${att.fullDownloadUrl}`);
    });

    return processedAttachments;
  },

  // Test downloading an attachment
  downloadAttachment: async (attachmentId) => {
    const fs = require('fs');
    const path = require('path');
    console.log(`\n===== Testing Attachment Download for ID: ${attachmentId} =====`);

    // First get attachment details
    console.log('\n📋 Step 1: Getting attachment details');
    const attachmentData = await makeApiRequest('post', '/api/v2/call', null, {
      model: 'ir.attachment',
      method: 'search_read',
      args: [
        [
          ['id', '=', attachmentId]
        ]
      ],
      kwargs: {
        fields: ['id', 'name', 'mimetype', 'file_size', 'create_date', 'create_uid', 'res_model', 'res_id', 'type', 'url']
      }
    });

    if (!attachmentData || !attachmentData.length) {
      console.error('❌ Failed to get attachment details');
      return null;
    }

    const attachment = attachmentData[0];
    console.log(`✅ Found attachment: ${attachment.name || attachment.datas_fname || `File-${attachment.id}`}`);
    console.log(`Mimetype: ${attachment.mimetype || 'Unknown'}`);
    console.log(`Size: ${attachment.file_size ? `${Math.round(attachment.file_size / 1024)} KB` : 'Unknown'}`);

    // Define all possible download URL formats based on Odoo's REST API
    const downloadUrls = [
      // Format 1: Direct web/image format (most reliable for images)
      `/web/image/${attachment.id}`,

      // Format 2: Direct web/content format (good for downloads)
      `/web/content/${attachment.id}?download=true`,

      // Format 3: API v2 download with model and ID
      `/api/v2/download?model=ir.attachment&id=${attachment.id}&field=raw&filename_field=name&type=file`,

      // Format 4: API v2 download with just ID
      `/api/v2/download/${attachment.id}`,

      // Format 5: API v2 download with ID and filename
      `/api/v2/download/${attachment.id}/${encodeURIComponent(attachment.name || `File-${attachment.id}`)}`,

      // Format 6: API v2 download with model, ID and field
      `/api/v2/download/${attachment.res_model}/${attachment.res_id}/${attachment.res_field || 'datas'}`,

      // Format 7: API v2 download with model, ID, field and filename
      attachment.res_field ?
        `/api/v2/download/${attachment.res_model}/${attachment.res_id}/${attachment.res_field}/${encodeURIComponent(attachment.name)}` :
        null
    ].filter(url => url !== null);

    console.log('\n📋 Step 2: Testing download URLs and saving files');

    // Create a downloads directory if it doesn't exist
    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir);
      console.log(`Created downloads directory: ${downloadsDir}`);
    }

    // Test each URL format and try to download the file
    for (let i = 0; i < downloadUrls.length; i++) {
      const url = downloadUrls[i];
      const fullUrl = `${config.baseURL}${url}`;
      const formatName = url.startsWith('/web/image') ? 'web/image' :
                         url.startsWith('/web/content') ? 'web/content' :
                         `api/v2/download format ${i-1}`;

      console.log(`\n🔄 Testing URL format: ${formatName}`);
      console.log(`URL: ${url}`);

      try {
        // First check if the URL is valid with a HEAD request
        console.log('Checking URL validity...');
        const headResponse = await axios({
          method: 'head',
          url: fullUrl,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'DATABASE': config.db
          },
          validateStatus: status => true // Accept any status to check the response
        });

        console.log(`Status code: ${headResponse.status}`);

        if (headResponse.status >= 200 && headResponse.status < 300) {
          console.log('✅ URL is valid and accessible');

          // Get content type and size from headers
          const contentType = headResponse.headers['content-type'];
          const contentLength = headResponse.headers['content-length'];
          const contentDisposition = headResponse.headers['content-disposition'];

          console.log(`Content-Type: ${contentType || 'Not specified'}`);
          console.log(`Content-Length: ${contentLength ? `${Math.round(parseInt(contentLength) / 1024)} KB` : 'Not specified'}`);
          console.log(`Content-Disposition: ${contentDisposition || 'Not specified'}`);

          // Now download the actual file
          console.log('Downloading file...');

          const getResponse = await axios({
            method: 'get',
            url: fullUrl,
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'DATABASE': config.db
            },
            responseType: 'arraybuffer'
          });

          if (getResponse.status >= 200 && getResponse.status < 300) {
            // Generate a filename based on the attachment and URL format
            let filename = attachment.name || `attachment_${attachment.id}`;

            // Add a prefix to identify the URL format used
            const prefix = formatName.replace(/[\/\s]/g, '_');
            filename = `${prefix}_${filename}`;

            // Ensure the filename is safe for the filesystem
            filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

            // Create the full file path
            const filePath = path.join(downloadsDir, filename);

            // Write the file to disk
            fs.writeFileSync(filePath, Buffer.from(getResponse.data));

            console.log(`✅ Successfully downloaded file: ${filename}`);
            console.log(`Saved to: ${filePath}`);
            console.log(`File size: ${Math.round(getResponse.data.length / 1024)} KB`);

            // For images, show a base64 preview
            if (contentType && contentType.startsWith('image/')) {
              const base64Preview = Buffer.from(getResponse.data).toString('base64').substring(0, 50);
              console.log(`Base64 preview: ${base64Preview}...`);
            }
          }
        } else {
          console.log(`❌ URL returned error status: ${headResponse.status}`);
          if (headResponse.data) {
            console.log('Error response:', headResponse.data);
          }
        }
      } catch (error) {
        console.error(`❌ Error testing URL: ${error.message}`);
        if (error.response) {
          console.error(`Status code: ${error.response.status}`);
          if (error.response.data) {
            try {
              // Try to parse the error response
              const errorData = Buffer.from(error.response.data).toString('utf8');
              console.error('Error response:', errorData.substring(0, 200) + (errorData.length > 200 ? '...' : ''));
            } catch (e) {
              console.error('Could not parse error response');
            }
          }
        }
      }
    }

    // Test the web/image URL with access_token parameter
    console.log('\n📋 Step 3: Testing web/image URL with access_token parameter');

    try {
      const webImageUrl = `/web/image/${attachment.id}?access_token=${accessToken}`;
      const fullWebImageUrl = `${config.baseURL}${webImageUrl}`;

      console.log(`Testing URL: ${webImageUrl}`);

      const response = await axios({
        method: 'get',
        url: fullWebImageUrl,
        responseType: 'arraybuffer',
        validateStatus: status => true
      });

      console.log(`Status code: ${response.status}`);

      if (response.status >= 200 && response.status < 300) {
        console.log('✅ URL is valid and accessible');

        // Save the file
        const filename = `web_image_with_token_${attachment.id}.${attachment.mimetype ? attachment.mimetype.split('/')[1] : 'bin'}`;
        const filePath = path.join(downloadsDir, filename);
        fs.writeFileSync(filePath, Buffer.from(response.data));

        console.log(`✅ Successfully downloaded file: ${filename}`);
        console.log(`Saved to: ${filePath}`);
        console.log(`File size: ${Math.round(response.data.length / 1024)} KB`);
      } else {
        console.log(`❌ URL returned error status: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Error testing web/image URL with token: ${error.message}`);
    }

    console.log('\n===== Download Test Complete =====');
    console.log(`All downloaded files are in: ${downloadsDir}`);
    return attachment;
  }
};

// Main menu
const showMenu = async () => {
  console.log('\n===== Odoo API Test Menu =====');
  console.log('1. Authenticate (get token)');
  console.log('2. Get user info');
  console.log('3. Get partner IDs');
  console.log('4. Get single partner by ID');
  console.log('5. Search_read with single ID');
  console.log('6. Search_read with multiple IDs (problematic)');
  console.log('7. Try search_extract endpoint');
  console.log('8. Try RPC call method');
  console.log('9. Run comprehensive test suite');
  console.log('10. Get all attachments for a partner');
  console.log('11. Test downloading an attachment');
  console.log('0. Exit');

  const choice = await askQuestion('\nEnter your choice: ');

  switch (choice) {
    case '1':
      accessToken = await getAuthToken();
      break;
    case '2':
      await testEndpoints.user();
      break;
    case '3':
      const limit = await askQuestion('Enter limit (default 10): ');
      await testEndpoints.getPartnerIds(parseInt(limit) || 10);
      break;
    case '4':
      const id = await askQuestion('Enter partner ID: ');
      await testEndpoints.getPartnerById(parseInt(id));
      break;
    case '5':
      const singleId = await askQuestion('Enter partner ID: ');
      await testEndpoints.searchReadSingleId(parseInt(singleId));
      break;
    case '6':
      const ids = await askQuestion('Enter comma-separated partner IDs: ');
      const idArray = ids.split(',').map(id => parseInt(id.trim()));
      await testEndpoints.searchReadMultipleIds(idArray);
      break;
    case '7':
      const extractLimit = await askQuestion('Enter limit (default 10): ');
      await testEndpoints.searchExtract(parseInt(extractLimit) || 10);
      break;
    case '8':
      const rpcIds = await askQuestion('Enter comma-separated partner IDs: ');
      const rpcIdArray = rpcIds.split(',').map(id => parseInt(id.trim()));
      await testEndpoints.rpcCall(rpcIdArray);
      break;
    case '9':
      await runTestSuite();
      break;
    case '10':
      const partnerId = await askQuestion('Enter partner ID to get attachments for: ');
      await testEndpoints.getPartnerAttachments(parseInt(partnerId));
      break;
    case '11':
      const attachmentId = await askQuestion('Enter attachment ID to download: ');
      await testEndpoints.downloadAttachment(parseInt(attachmentId));
      break;
    case '0':
      console.log('Exiting...');
      rl.close();
      return false;
    default:
      console.log('Invalid choice, please try again.');
  }
  return true;
};

// Run a comprehensive test suite
const runTestSuite = async () => {
  console.log('\n===== Running Comprehensive Test Suite =====');

  // First make sure we have a token
  if (!accessToken) {
    console.log('Getting authentication token first...');
    accessToken = await getAuthToken();
    if (!accessToken) return;
  }

  // Step 1: Get user info to verify token works
  console.log('\n📋 Step 1: Verifying user access');
  const userInfo = await testEndpoints.user();
  if (!userInfo) {
    console.error('❌ User verification failed. Stopping tests.');
    return;
  }

  // Step 2: Get partner IDs
  console.log('\n📋 Step 2: Getting partner IDs');
  const partnerIds = await testEndpoints.getPartnerIds(10);
  if (!partnerIds || !partnerIds.length) {
    console.error('❌ Failed to get partner IDs. Stopping tests.');
    return;
  }

  // Step 3: Test single partner fetch
  console.log('\n📋 Step 3: Testing single partner fetch');
  const singlePartner = await testEndpoints.getPartnerById(partnerIds[0]);
  if (!singlePartner) {
    console.log('❌ Single partner fetch failed.');
  }

  // Step 4: Test search_read with single ID
  console.log('\n📋 Step 4: Testing search_read with single ID');
  const searchReadSingle = await testEndpoints.searchReadSingleId(partnerIds[0]);
  if (!searchReadSingle) {
    console.log('❌ Search_read with single ID failed.');
  }

  // Step 5: Test search_read with multiple IDs (the problematic one)
  console.log('\n📋 Step 5: Testing search_read with multiple IDs');
  const searchReadMultiple = await testEndpoints.searchReadMultipleIds(partnerIds.slice(0, 5));
  if (!searchReadMultiple) {
    console.log('❌ Search_read with multiple IDs failed.');
  }

  // Step 6: Test search_extract
  console.log('\n📋 Step 6: Testing search_extract endpoint');
  const searchExtract = await testEndpoints.searchExtract(5);
  if (!searchExtract) {
    console.log('❌ Search_extract endpoint failed.');
  }

  // Step 7: Test RPC call method
  console.log('\n📋 Step 7: Testing RPC call method');
  const rpcCall = await testEndpoints.rpcCall(partnerIds.slice(0, 5));
  if (!rpcCall) {
    console.log('❌ RPC call method failed.');
  }

  console.log('\n===== Test Suite Complete =====');
  console.log('Working methods:');
  if (userInfo) console.log('✅ User info endpoint');
  if (partnerIds && partnerIds.length) console.log('✅ Partner IDs search endpoint');
  if (singlePartner) console.log('✅ Single partner fetch via read endpoint');
  if (searchReadSingle) console.log('✅ Search_read with single ID');
  if (searchReadMultiple) console.log('✅ Search_read with multiple IDs');
  if (searchExtract) console.log('✅ Search_extract endpoint');
  if (rpcCall && rpcCall.result) console.log('✅ RPC call method');

  console.log('\nFailing methods:');
  if (!userInfo) console.log('❌ User info endpoint');
  if (!partnerIds || !partnerIds.length) console.log('❌ Partner IDs search endpoint');
  if (!singlePartner) console.log('❌ Single partner fetch via read endpoint');
  if (!searchReadSingle) console.log('❌ Search_read with single ID');
  if (!searchReadMultiple) console.log('❌ Search_read with multiple IDs');
  if (!searchExtract) console.log('❌ Search_extract endpoint');
  if (!rpcCall || !rpcCall.result) console.log('❌ RPC call method');
};

// Main function
const main = async () => {
  console.log('📱 ExoMobile Odoo API Test Tool 📱');
  console.log('This tool helps diagnose API issues by testing various endpoints.\n');

  let continueRunning = true;
  while (continueRunning) {
    continueRunning = await showMenu();
  }
};

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
});
