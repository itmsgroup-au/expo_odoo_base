import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Linking,
  Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import logger from '../../../utils/logger';

const { width, height } = Dimensions.get('window');

const ImageViewerScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { imageUrl, title, mimetype } = route.params || {};

  // Open file in external viewer
  const openInExternalViewer = async () => {
    try {
      if (!imageUrl) {
        throw new Error('No file URL provided');
      }

      console.log(`Attempting to open URL: ${imageUrl}`);

      const canOpen = await Linking.canOpenURL(imageUrl);

      if (canOpen) {
        await Linking.openURL(imageUrl);
      } else {
        Alert.alert(
          'Cannot Open File',
          'Unable to open this file type on your device.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      logger.safeErrorLog('Error opening file in external viewer:', err);
      Alert.alert(
        'Error',
        'Failed to open the file in an external viewer. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'File Viewer'}
        </Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={openInExternalViewer}
        >
          <Icon name="open-in-new" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        <View style={styles.messageContainer}>
          <Icon
            name={mimetype && mimetype.startsWith('image/') ? "image" : "file-document-outline"}
            size={64}
            color="#fff"
          />
          <Text style={styles.messageTitle}>
            {title || 'File'}
          </Text>
          <Text style={styles.messageText}>
            This file cannot be previewed directly in the app.
          </Text>
          <TouchableOpacity style={styles.openButton} onPress={openInExternalViewer}>
            <Text style={styles.openButtonText}>Open in External App</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginHorizontal: 16,
    textAlign: 'center',
  },
  actionButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  messageContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
  },
  messageTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  openButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ImageViewerScreen;
