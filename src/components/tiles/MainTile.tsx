import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface MainTileProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  route: string;
}

const MainTile: React.FC<MainTileProps> = ({ title, icon, color, route }) => {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate(route);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      testID={`tile-${title.toLowerCase()}`}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          {icon}
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.viewAll}>View All</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  count: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  viewAll: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B82F6',
  },
});

export default MainTile;