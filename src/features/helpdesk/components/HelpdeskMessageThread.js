import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MessageThread from '../../../components/MessageThread';

/**
 * A wrapper component for MessageThread that handles navigation to the correct attachments screen
 * for helpdesk tickets.
 * 
 * @param {Object} props - Component props
 * @param {string} props.model - The model name (e.g., 'helpdesk.ticket')
 * @param {number|string} props.recordId - The record ID
 * @param {string} props.recordName - The record name
 */
const HelpdeskMessageThread = ({ model, recordId, recordName, ...props }) => {
  const navigation = useNavigation();

  // Custom navigation handler for attachments
  const handleNavigateToAttachments = () => {
    console.log('Navigating to HelpdeskAttachments with:', { ticketId: recordId, ticketName: recordName });
    navigation.navigate('HelpdeskAttachments', {
      ticketId: parseInt(recordId, 10),
      ticketName: recordName || 'Ticket'
    });
  };

  return (
    <View style={styles.container}>
      <MessageThread
        model={model}
        recordId={recordId}
        recordName={recordName}
        onNavigateToAttachments={handleNavigateToAttachments}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default HelpdeskMessageThread;
