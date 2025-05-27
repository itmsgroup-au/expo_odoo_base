import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  TextInput,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import logger from '../utils/logger';

const LogViewer = ({ visible, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [count, setCount] = useState(20);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (visible) {
      refreshLogs();
    }
  }, [visible, filter, count]);

  const refreshLogs = () => {
    const history = logger.getHistory(filter, count);
    setLogs(history);
  };

  const shareLogsText = async () => {
    try {
      const history = logger.getHistory(filter, count);
      const text = history.map(entry =>
        `[${new Date(entry.timestamp).toISOString()}] ${entry.type}: ${entry.message}`
      ).join('\n\n');

      await Share.share({
        message: text,
        title: 'Application Logs'
      });
    } catch (error) {
      console.error('Failed to share logs:', error);
      alert('Failed to share logs');
    }
  };

  const clearLogs = () => {
    logger.clearHistory();
    refreshLogs();
  };

  const filteredLogs = searchText
    ? logs.filter(log => log.message.toLowerCase().includes(searchText.toLowerCase()))
    : logs;

  const getLogColor = (type) => {
    switch (type) {
      case 'errors': return '#FF5252';
      case 'warnings': return '#FFD740';
      case 'info': return '#40C4FF';
      case 'debug': return '#69F0AE';
      default: return '#FFFFFF';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Log Viewer</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Type:</Text>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
              onPress={() => setFilter('all')}
            >
              <Text style={styles.filterText}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'errors' && styles.activeFilter]}
              onPress={() => setFilter('errors')}
            >
              <Text style={styles.filterText}>Errors</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'warnings' && styles.activeFilter]}
              onPress={() => setFilter('warnings')}
            >
              <Text style={styles.filterText}>Warnings</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search logs..."
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={refreshLogs}>
              <Icon name="refresh" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={shareLogsText}>
              <Icon name="share" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={clearLogs}>
              <Icon name="delete" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.logContainer}>
          {filteredLogs.length === 0 ? (
            <Text style={styles.emptyText}>No logs to display</Text>
          ) : (
            filteredLogs.map((log, index) => (
              <View key={index} style={styles.logEntry}>
                <Text style={styles.timestamp}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
                <Text style={[styles.logType, { color: getLogColor(log.type) }]}>
                  {log.type.toUpperCase()}
                </Text>
                <Text style={styles.logMessage} selectable={true}>
                  {log.message}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.copyButton} onPress={shareLogsText}>
            <Icon name="share" size={20} color="#FFF" />
            <Text style={styles.copyButtonText}>Share Logs</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E1E1E',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  closeButton: {
    padding: 8,
  },
  toolbar: {
    padding: 8,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    color: '#CCC',
    marginRight: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#333',
  },
  activeFilter: {
    backgroundColor: '#0066CC',
  },
  filterText: {
    color: '#FFF',
    fontSize: 12,
  },
  searchContainer: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#333',
    color: '#FFF',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  logContainer: {
    flex: 1,
    padding: 8,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  logEntry: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#444',
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  logType: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
  },
  logMessage: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  footer: {
    padding: 16,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066CC',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  copyButtonText: {
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default LogViewer;
