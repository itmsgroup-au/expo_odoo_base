import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import ContactsListScreen from './screens/ContactsListScreen';
import ContactDetailScreen from './screens/ContactDetailScreen';
import ContactFormScreen from './screens/ContactFormScreen';
import AttachmentsScreen from './screens/AttachmentsScreen';
import ExpoImageViewerScreen from './screens/ExpoImageViewerScreen';

const Stack = createStackNavigator();

const ContactsNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="ContactsListScreen"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#fff' },
        // Disable gesture navigation for all screens in this navigator
        gestureEnabled: false,
        gestureResponseDistance: 0,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="ContactsListScreen" component={ContactsListScreen} />
      <Stack.Screen name="ContactDetail" component={ContactDetailScreen} />
      <Stack.Screen
        name="ContactForm"
        component={ContactFormScreen}
        options={{
          gestureEnabled: false, // Completely disable gesture navigation
          gestureResponseDistance: 0,
          cardOverlayEnabled: false,
          animationEnabled: true, // Keep animations
        }}
      />
      <Stack.Screen
        name="Attachments"
        component={AttachmentsScreen}
        options={{
          gestureEnabled: false,
          gestureResponseDistance: 0,
          cardOverlayEnabled: false,
          animationEnabled: true,
        }}
      />
      <Stack.Screen
        name="ImageViewer"
        component={ExpoImageViewerScreen}
        options={{
          gestureEnabled: false,
          gestureResponseDistance: 0,
          cardOverlayEnabled: false,
          animationEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
};

export default ContactsNavigator;
