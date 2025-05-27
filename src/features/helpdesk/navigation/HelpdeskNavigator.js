import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../../contexts/ThemeContext';
import HelpdeskTicketsScreen from '../screens/HelpdeskTicketsScreen';
import HelpdeskTicketDetailScreen from '../screens/HelpdeskTicketDetailScreen';
import HelpdeskTicketFormScreen from '../screens/HelpdeskTicketFormScreen';
import HelpdeskAttachmentsScreen from '../screens/HelpdeskAttachmentsScreen';
import ExpoImageViewerScreen from '../../contacts/screens/ExpoImageViewerScreen';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { TouchableOpacity } from 'react-native';

const Stack = createStackNavigator();

const HelpdeskNavigator = () => {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="HelpdeskTickets"
        component={HelpdeskTicketsScreen}
        options={({ navigation }) => ({
          title: 'Helpdesk Tickets',
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => navigation.navigate('HelpdeskTicketForm')}
            >
              <Icon name="plus" size={24} color={colors.onPrimary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="HelpdeskTicketDetail"
        component={HelpdeskTicketDetailScreen}
        options={{
          title: 'Ticket Details',
        }}
      />
      <Stack.Screen
        name="HelpdeskTicketForm"
        component={HelpdeskTicketFormScreen}
        options={({ route }) => ({
          title: route.params?.ticketId ? 'Edit Ticket' : 'New Ticket',
        })}
      />
      <Stack.Screen
        name="HelpdeskAttachments"
        component={HelpdeskAttachmentsScreen}
        options={{
          title: 'Ticket Attachments',
        }}
      />
      <Stack.Screen
        name="ExpoImageViewer"
        component={ExpoImageViewerScreen}
        options={{
          title: 'Image Viewer',
          headerTransparent: true,
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
};

export default HelpdeskNavigator;
