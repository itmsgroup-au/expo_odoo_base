import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MainTile from '../MainTile';

const mockNavigate = jest.fn();

// Mock the useNavigation hook
jest.mock('@react-navigation/native', () => {
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

describe('MainTile Component', () => {
  const defaultProps = {
    title: 'Contacts',
    icon: <></>,
    color: '#3B82F6',
    count: 42,
    route: 'ContactsList',
  };

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('renders correctly with all props', () => {
    const { getByText, getByTestId } = render(<MainTile {...defaultProps} />);
    
    expect(getByTestId('main-tile-contacts')).toBeTruthy();
    expect(getByText('Contacts')).toBeTruthy();
    expect(getByText('42 items')).toBeTruthy();
    expect(getByText('View All')).toBeTruthy();
  });

  test('renders without count when not provided', () => {
    const props = { ...defaultProps, count: undefined };
    const { queryByText } = render(<MainTile {...props} />);
    
    expect(queryByText(/items/)).toBeNull();
  });

  test('navigates to the correct route when pressed', () => {
    const { getByTestId } = render(<MainTile {...defaultProps} />);
    
    fireEvent.press(getByTestId('main-tile-contacts'));
    expect(mockNavigate).toHaveBeenCalledWith('ContactsList');
  });
});
