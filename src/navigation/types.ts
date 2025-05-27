import { NavigatorScreenParams } from '@react-navigation/native';

// Define the parameter types for each route
export type RootStackParamList = {
  // Auth screens
  Login: undefined;

  // Main screens
  Home: undefined;
  HomeDrawer: undefined;

  // Module screens
  ContactsList: undefined;
  ContactDetail: { id: number };
  ContactForm: { mode: 'create' | 'edit', id?: number, contact?: any };
  InventoryList: undefined;
  InventoryDetail: { id: number };
  HelpdeskTickets: undefined;
  HelpdeskTicketDetail: { ticketId: number };
  HelpdeskTicketForm: { ticketId?: number, teamId?: number };
  HelpdeskList: undefined;
  CalendarView: undefined;
  CalendarDetail: { id: number };

  // Activity-related screens
  Chat: undefined;
  ActivityList: undefined;
  SalesDetail: { id: number };
  TicketDetail: { id: number };
  InvoiceDetail: { id: number };
  ReportDetail: { id: number };

  // Navigation screens
  Favorites: undefined;
  Profile: undefined;
  EditProfile: { userId?: number };
  Settings: undefined;
  Notifications: undefined;
};

// Declare the navigation types for TypeScript type safety
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}