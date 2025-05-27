import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import logger from '../utils/logger';

/**
 * A component that provides options to pick attachments from camera, gallery, or files
 */
const AttachmentPicker = ({ visible, onClose, onAttachmentSelected }) => {
  const [loading, setLoading] = useState(false);

  // Handle picking an image from the gallery
  const handlePickImage = async () => {
    try {
      setLoading(true);

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to add images.');
        setLoading(false);
        return;
      }

      // Launch image picker with optimized settings
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5, // Lower quality to reduce file size
        base64: true,
        exif: false,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];

        // Ensure we have base64 data
        if (!asset.base64) {
          console.warn('Image picker did not return base64 data');
          Alert.alert('Warning', 'Could not process the image properly. Please try another image.');
          setLoading(false);
          return;
        }

        // Check file size - warn if it's too large
        const fileSizeKB = Math.round(asset.base64.length / 1024);
        if (fileSizeKB > 2000) { // 2MB limit
          console.warn(`Large file detected: ${fileSizeKB}KB`);
          Alert.alert(
            'Large File',
            'The image is quite large which may cause upload issues. Would you like to proceed anyway or select a smaller image?',
            [
              {
                text: 'Select Another Image',
                onPress: () => {
                  setLoading(false);
                  handlePickImage(); // Retry
                }
              },
              {
                text: 'Proceed Anyway',
                onPress: () => {
                  // Continue with the large file
                  processImageAttachment(asset);
                }
              }
            ]
          );
          return;
        }

        // Process the image attachment
        processImageAttachment(asset);
      } else {
        // User canceled
        onClose();
      }
    } catch (err) {
      console.error('Error picking image:', err);
      logger.safeErrorLog('Error picking image:', err);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setLoading(false);
    }
  };

  // Process an image attachment
  const processImageAttachment = (asset) => {
    try {
      // Generate a more descriptive filename
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const filename = `image_${timestamp}.jpg`;

      // Create attachment object
      const newAttachment = {
        id: Date.now().toString(),
        uri: asset.uri,
        base64: asset.base64,
        type: 'image/jpeg',
        name: filename,
        size: Math.round(asset.base64.length / 1024) // Size in KB
      };

      // Pass the attachment to the parent component
      onAttachmentSelected(newAttachment);
      onClose();
    } catch (err) {
      console.error('Error processing image:', err);
      logger.safeErrorLog('Error processing image:', err);
      Alert.alert('Error', 'Failed to process image. Please try again.');
      setLoading(false);
    }
  };

  // Handle taking a photo with the camera
  const handleTakePhoto = async () => {
    try {
      setLoading(true);

      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera permissions to take photos.');
        setLoading(false);
        return;
      }

      // Launch camera with optimized settings - use lower quality to reduce file size
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5, // Lower quality to reduce file size
        base64: true,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];

        // Ensure we have base64 data
        if (!asset.base64) {
          console.warn('Camera did not return base64 data');
          Alert.alert('Warning', 'Could not process the photo properly. Please try again.');
          setLoading(false);
          return;
        }

        // Check file size - warn if it's too large
        const fileSizeKB = Math.round(asset.base64.length / 1024);
        if (fileSizeKB > 2000) { // 2MB limit
          console.warn(`Large file detected: ${fileSizeKB}KB`);
          Alert.alert(
            'Large File',
            'The photo is quite large which may cause upload issues. Would you like to proceed anyway or take a smaller photo?',
            [
              {
                text: 'Take Another Photo',
                onPress: () => {
                  setLoading(false);
                  handleTakePhoto(); // Retry
                }
              },
              {
                text: 'Proceed Anyway',
                onPress: () => {
                  // Continue with the large file
                  processPhotoAttachment(asset);
                }
              }
            ]
          );
          return;
        }

        // Process the photo attachment
        processPhotoAttachment(asset);
      } else {
        // User canceled
        onClose();
      }
    } catch (err) {
      console.error('Error taking photo:', err);
      logger.safeErrorLog('Error taking photo:', err);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      setLoading(false);
    }
  };

  // Process a photo attachment
  const processPhotoAttachment = (asset) => {
    try {
      // Generate a more descriptive filename
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const filename = `photo_${timestamp}.jpg`;

      // Create attachment object
      const newAttachment = {
        id: Date.now().toString(),
        uri: asset.uri,
        base64: asset.base64,
        type: 'image/jpeg',
        name: filename,
        size: Math.round(asset.base64.length / 1024) // Size in KB
      };

      // Pass the attachment to the parent component
      onAttachmentSelected(newAttachment);
      onClose();
    } catch (err) {
      console.error('Error processing photo:', err);
      logger.safeErrorLog('Error processing photo:', err);
      Alert.alert('Error', 'Failed to process photo. Please try again.');
      setLoading(false);
    }
  };

  // Handle picking a document/file
  const handlePickDocument = async () => {
    try {
      setLoading(true);

      // Launch document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // All file types
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets[0]) {
        const asset = result.assets[0];

        // Check file size before reading it
        if (asset.size && asset.size > 2000000) { // 2MB in bytes
          const fileSizeMB = (asset.size / (1024 * 1024)).toFixed(2);
          console.warn(`Large file detected: ${fileSizeMB}MB`);

          Alert.alert(
            'Large File',
            `The file is quite large (${fileSizeMB}MB) which may cause upload issues. Would you like to proceed anyway or select a smaller file?`,
            [
              {
                text: 'Select Another File',
                onPress: () => {
                  setLoading(false);
                  handlePickDocument(); // Retry
                }
              },
              {
                text: 'Proceed Anyway',
                onPress: () => {
                  // Continue with the large file
                  processDocumentFile(asset);
                }
              }
            ]
          );
          return;
        }

        // Process the document file
        await processDocumentFile(asset);
      } else {
        // User canceled
        onClose();
      }
    } catch (err) {
      console.error('Error picking document:', err);
      logger.safeErrorLog('Error picking document:', err);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
      setLoading(false);
    }
  };

  // Process a document file
  const processDocumentFile = async (asset) => {
    try {
      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Check base64 size
      const fileSizeKB = Math.round(base64.length / 1024);
      console.log(`File size after base64 encoding: ${fileSizeKB}KB`);

      // Create attachment object
      const newAttachment = {
        id: Date.now().toString(),
        uri: asset.uri,
        base64: base64,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || `file_${Date.now()}`,
        size: fileSizeKB, // Size in KB
      };

      // Pass the attachment to the parent component
      onAttachmentSelected(newAttachment);
      onClose();
    } catch (fileError) {
      console.error('Error processing file:', fileError);
      logger.safeErrorLog('Error processing file:', fileError);
      Alert.alert('Error', 'Failed to process the selected file. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Attachment</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0073e6" />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          ) : (
            <View style={styles.optionsContainer}>
              <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
                <Icon name="camera" size={32} color="#0073e6" />
                <Text style={styles.optionText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={handlePickImage}>
                <Icon name="image" size={32} color="#0073e6" />
                <Text style={styles.optionText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={handlePickDocument}>
                <Icon name="file-document-outline" size={32} color="#0073e6" />
                <Text style={styles.optionText}>Document</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  option: {
    alignItems: 'center',
    padding: 15,
  },
  optionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
  },
  cancelButton: {
    paddingVertical: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#ff3b30',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default AttachmentPicker;
