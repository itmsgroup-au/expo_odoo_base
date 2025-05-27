import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  getHelpdeskTicket,
  getHelpdeskTeams,
  getHelpdeskStages,
  getHelpdeskTicketTypes,
  createHelpdeskTicket,
  updateHelpdeskTicket,
} from '../../../api/helpdeskServiceV2';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const HelpdeskTicketFormScreen = ({ route }) => {
  const { ticketId, teamId } = route.params || {};
  const isEditing = !!ticketId;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    team_id: teamId || false,
    priority: '0',
    ticket_type_id: false,
    partner_id: false,
    partner_name: '',
    partner_email: '',
    partner_phone: '',
    user_id: false,
    stage_id: false,
    tag_ids: [],
  });

  const [teams, setTeams] = useState([]);
  const [stages, setStages] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const navigation = useNavigation();
  const { colors } = useTheme();

  useEffect(() => {
    loadFormData();
  }, [ticketId, teamId]);

  useEffect(() => {
    // Load stages when team changes
    if (formData.team_id) {
      loadStages(formData.team_id);
    }
  }, [formData.team_id]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load teams and ticket types
      const [teamsData, typesData] = await Promise.all([
        getHelpdeskTeams(),
        getHelpdeskTicketTypes(),
      ]);

      setTeams(teamsData || []);
      setTicketTypes(typesData || []);

      // If editing, load ticket data
      if (isEditing) {
        const ticket = await getHelpdeskTicket(ticketId);
        if (ticket) {
          setFormData({
            name: ticket.name || '',
            description: ticket.description || '',
            team_id: ticket.team_id ? ticket.team_id[0] : false,
            priority: ticket.priority !== undefined ? ticket.priority.toString() : '0',
            ticket_type_id: ticket.ticket_type_id ? ticket.ticket_type_id[0] : false,
            partner_id: ticket.partner_id ? ticket.partner_id[0] : false,
            partner_name: ticket.partner_name || '',
            partner_email: ticket.partner_email || '',
            partner_phone: ticket.partner_phone || '',
            user_id: ticket.user_id ? ticket.user_id[0] : false,
            stage_id: ticket.stage_id ? ticket.stage_id[0] : false,
            tag_ids: ticket.tag_ids || [],
          });

          // Load stages for this team
          if (ticket.team_id) {
            await loadStages(ticket.team_id[0]);
          }
        } else {
          setError('Ticket not found');
        }
      } else if (teamId) {
        // If creating with a pre-selected team, load stages for that team
        await loadStages(teamId);
      }
    } catch (error) {
      console.error('Error loading form data:', error);
      setError('Failed to load form data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadStages = async (teamId) => {
    try {
      const stagesData = await getHelpdeskStages(teamId);
      setStages(stagesData || []);

      // Set default stage if creating a new ticket
      if (!isEditing && stagesData && stagesData.length > 0) {
        // Find the first stage (usually "New")
        const firstStage = stagesData.sort((a, b) => a.sequence - b.sequence)[0];
        setFormData(prev => ({ ...prev, stage_id: firstStage.id }));
      }
    } catch (error) {
      console.error('Error loading stages:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a ticket name');
      return false;
    }

    if (!formData.team_id) {
      Alert.alert('Error', 'Please select a team');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      // Prepare data for API
      const ticketData = {
        name: formData.name,
        description: formData.description,
        team_id: formData.team_id,
        priority: parseInt(formData.priority),
        ticket_type_id: formData.ticket_type_id || false,
        partner_id: formData.partner_id || false,
        partner_name: formData.partner_name || '',
        partner_email: formData.partner_email || '',
        partner_phone: formData.partner_phone || '',
        user_id: formData.user_id || false,
        stage_id: formData.stage_id || false,
        tag_ids: formData.tag_ids && formData.tag_ids.length > 0 ?
          [6, 0, formData.tag_ids] : false, // Command 6 is "replace with"
      };

      if (isEditing) {
        // Update existing ticket
        await updateHelpdeskTicket(ticketId, ticketData);
        Alert.alert('Success', 'Ticket updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        // Create new ticket
        const newTicketId = await createHelpdeskTicket(ticketData);
        Alert.alert('Success', 'Ticket created successfully', [
          { text: 'OK', onPress: () => navigation.replace('HelpdeskTicketDetail', { ticketId: newTicketId }) }
        ]);
      }
    } catch (error) {
      console.error('Error submitting ticket:', error);
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'create'} ticket. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={loadFormData}
        >
          <Text style={[styles.retryButtonText, { color: colors.onPrimary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Information</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Ticket Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            placeholder="Enter ticket name"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Team *</Text>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Picker
              selectedValue={formData.team_id}
              onValueChange={(value) => handleInputChange('team_id', value)}
              style={[styles.picker, { color: colors.text }]}
            >
              <Picker.Item label="Select a team" value={false} />
              {teams.map(team => (
                <Picker.Item key={team.id} label={team.name} value={team.id} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Priority</Text>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Picker
              selectedValue={formData.priority}
              onValueChange={(value) => handleInputChange('priority', value)}
              style={[styles.picker, { color: colors.text }]}
            >
              <Picker.Item label="Low" value="0" />
              <Picker.Item label="Medium" value="1" />
              <Picker.Item label="High" value="2" />
              <Picker.Item label="Urgent" value="3" />
            </Picker>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Ticket Type</Text>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Picker
              selectedValue={formData.ticket_type_id}
              onValueChange={(value) => handleInputChange('ticket_type_id', value)}
              style={[styles.picker, { color: colors.text }]}
            >
              <Picker.Item label="Select a type" value={false} />
              {ticketTypes.map(type => (
                <Picker.Item key={type.id} label={type.name} value={type.id} />
              ))}
            </Picker>
          </View>
        </View>

        {stages.length > 0 && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Stage</Text>
            <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Picker
                selectedValue={formData.stage_id}
                onValueChange={(value) => handleInputChange('stage_id', value)}
                style={[styles.picker, { color: colors.text }]}
              >
                <Picker.Item label="Select a stage" value={false} />
                {stages.map(stage => (
                  <Picker.Item key={stage.id} label={stage.name} value={stage.id} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Customer Information</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Customer Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={formData.partner_name}
            onChangeText={(value) => handleInputChange('partner_name', value)}
            placeholder="Enter customer name"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Customer Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={formData.partner_email}
            onChangeText={(value) => handleInputChange('partner_email', value)}
            placeholder="Enter customer email"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Customer Phone</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={formData.partner_phone}
            onChangeText={(value) => handleInputChange('partner_phone', value)}
            placeholder="Enter customer phone"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Ticket Details</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <View style={styles.descriptionInfo}>
            <Icon name="information-outline" size={16} color={colors.primary} style={styles.infoIcon} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              HTML formatting is supported (images, links, formatting)
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }
            ]}
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder="Enter ticket description (HTML supported)"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={[styles.submitButtonText, { color: colors.onPrimary }]}>
              {isEditing ? 'Update Ticket' : 'Create Ticket'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  descriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 6,
  },
  infoText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  textArea: {
    height: 160,
    paddingTop: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 48,
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 16,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HelpdeskTicketFormScreen;
