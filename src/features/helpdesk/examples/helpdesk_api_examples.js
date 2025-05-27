/**
 * Helpdesk API Implementation Examples
 * 
 * This file contains practical examples of how to use the Helpdesk REST API
 * in your React Native application.
 */

import { 
  getHelpdeskTickets, 
  getHelpdeskTicket, 
  createHelpdeskTicket,
  updateHelpdeskTicket,
  getHelpdeskTeams,
  getHelpdeskStages,
  getHelpdeskTicketTypes,
  getHelpdeskTags,
  getHelpdeskSLAPolicies,
  getTicketSLAStatus,
  createTicketTimesheet,
  getTicketTimesheets,
  getTicketAttachments
} from '../../../api/helpdeskServiceV2';

/**
 * Example: Fetch all tickets for a specific team and show in a list
 * 
 * Usage:
 * ```
 * import { fetchTicketsForTeam } from './helpdesk_api_examples';
 * 
 * const MyComponent = () => {
 *   const [tickets, setTickets] = useState([]);
 *   const [loading, setLoading] = useState(false);
 *   
 *   useEffect(() => {
 *     const loadTickets = async () => {
 *       setLoading(true);
 *       const result = await fetchTicketsForTeam(5); // Team ID: 5
 *       setTickets(result);
 *       setLoading(false);
 *     };
 *     
 *     loadTickets();
 *   }, []);
 *   
 *   // Render tickets...
 * };
 * ```
 */
export const fetchTicketsForTeam = async (teamId, limit = 50) => {
  try {
    // Get tickets for a specific team
    const tickets = await getHelpdeskTickets({
      domain: [['team_id', '=', teamId]],
      fields: [
        'id', 
        'name', 
        'stage_id',
        'user_id',
        'partner_name',
        'priority',
        'create_date',
        'sla_deadline',
        'sla_fail'
      ],
      limit
    });
    
    return tickets || [];
  } catch (error) {
    console.error('Error fetching tickets for team:', error);
    return [];
  }
};

/**
 * Example: Fetch all tickets assigned to the current user
 * 
 * Usage:
 * ```
 * import { fetchMyTickets } from './helpdesk_api_examples';
 * 
 * const MyTicketsScreen = () => {
 *   const [tickets, setTickets] = useState([]);
 *   const [refreshing, setRefreshing] = useState(false);
 *   
 *   const loadTickets = async () => {
 *     setRefreshing(true);
 *     const result = await fetchMyTickets();
 *     setTickets(result);
 *     setRefreshing(false);
 *   };
 *   
 *   useEffect(() => {
 *     loadTickets();
 *   }, []);
 *   
 *   // Render tickets with pull-to-refresh...
 * };
 * ```
 */
export const fetchMyTickets = async (limit = 50) => {
  try {
    // Get the current user ID from the auth state
    // This is just a placeholder - in a real app, you'd get this from your auth context
    const currentUserId = 1; // Replace with actual user ID
    
    // Get tickets assigned to the current user
    const tickets = await getHelpdeskTickets({
      domain: [['user_id', '=', currentUserId]],
      fields: [
        'id', 
        'name', 
        'team_id',
        'stage_id',
        'partner_name',
        'priority',
        'create_date',
        'sla_deadline',
        'sla_fail'
      ],
      limit
    });
    
    return tickets || [];
  } catch (error) {
    console.error('Error fetching my tickets:', error);
    return [];
  }
};

/**
 * Example: Fetch tickets filtered by multiple criteria
 * 
 * Usage:
 * ```
 * import { fetchFilteredTickets } from './helpdesk_api_examples';
 * 
 * // In your component
 * const filters = {
 *   teamId: 5,
 *   stageId: 3,
 *   priority: '3', // High priority
 *   overdueOnly: true
 * };
 * 
 * const tickets = await fetchFilteredTickets(filters);
 * ```
 */
export const fetchFilteredTickets = async (filters = {}, limit = 50) => {
  try {
    const {
      teamId,
      stageId,
      priority,
      overdueOnly,
      partnerName,
      searchText
    } = filters;
    
    // Build domain filter based on provided criteria
    let domain = [];
    
    if (teamId) {
      domain.push(['team_id', '=', teamId]);
    }
    
    if (stageId) {
      domain.push(['stage_id', '=', stageId]);
    }
    
    if (priority) {
      domain.push(['priority', '=', priority]);
    }
    
    if (overdueOnly) {
      const now = new Date().toISOString();
      domain.push(['sla_deadline', '<', now]);
      domain.push(['sla_fail', '=', false]);
    }
    
    if (partnerName) {
      domain.push(['partner_name', 'ilike', partnerName]);
    }
    
    if (searchText) {
      domain.push('|');
      domain.push(['name', 'ilike', searchText]);
      domain.push(['description', 'ilike', searchText]);
    }
    
    // Get filtered tickets
    const tickets = await getHelpdeskTickets({
      domain,
      fields: [
        'id', 
        'name', 
        'team_id',
        'stage_id',
        'user_id',
        'partner_name',
        'priority',
        'create_date',
        'sla_deadline',
        'sla_fail'
      ],
      limit
    });
    
    return tickets || [];
  } catch (error) {
    console.error('Error fetching filtered tickets:', error);
    return [];
  }
};

/**
 * Example: Create a new ticket
 * 
 * Usage:
 * ```
 * import { createNewTicket } from './helpdesk_api_examples';
 * 
 * const handleSubmit = async (formData) => {
 *   const result = await createNewTicket(formData);
 *   if (result) {
 *     // Ticket created successfully
 *     navigation.navigate('TicketDetail', { ticketId: result });
 *   }
 * };
 * ```
 */
export const createNewTicket = async (formData) => {
  try {
    // Transform form data to match API requirements
    const ticketData = {
      name: formData.subject,
      description: formData.description || '',
      team_id: formData.teamId,
      priority: formData.priority || '1',
    };
    
    // Add optional fields if provided
    if (formData.partnerId) {
      ticketData.partner_id = formData.partnerId;
    }
    
    if (formData.partnerName) {
      ticketData.partner_name = formData.partnerName;
    }
    
    if (formData.partnerEmail) {
      ticketData.partner_email = formData.partnerEmail;
    }
    
    if (formData.partnerPhone) {
      ticketData.partner_phone = formData.partnerPhone;
    }
    
    if (formData.stageId) {
      ticketData.stage_id = formData.stageId;
    }
    
    if (formData.userId) {
      ticketData.user_id = formData.userId;
    }
    
    if (formData.ticketTypeId) {
      ticketData.ticket_type_id = formData.ticketTypeId;
    }
    
    if (formData.tagIds && formData.tagIds.length > 0) {
      ticketData.tag_ids = [
        [6, 0, formData.tagIds] // Magic format for many2many field: [6, 0, ids]
      ];
    }
    
    // Create the ticket
    const ticketId = await createHelpdeskTicket(ticketData);
    
    if (ticketId) {
      console.log(`Ticket created successfully with ID: ${ticketId}`);
      return ticketId;
    } else {
      console.error('Failed to create ticket: No ID returned');
      return null;
    }
  } catch (error) {
    console.error('Error creating ticket:', error);
    return null;
  }
};

/**
 * Example: Update a ticket's stage
 * 
 * Usage:
 * ```
 * import { updateTicketStage } from './helpdesk_api_examples';
 * 
 * const moveTicket = async (ticketId, newStageId) => {
 *   const success = await updateTicketStage(ticketId, newStageId);
 *   if (success) {
 *     // Ticket updated successfully
 *     showToast('Ticket status updated');
 *   }
 * };
 * ```
 */
export const updateTicketStage = async (ticketId, stageId) => {
  try {
    // Update only the stage_id field
    const success = await updateHelpdeskTicket(ticketId, {
      stage_id: stageId
    });
    
    return success;
  } catch (error) {
    console.error(`Error updating ticket ${ticketId} stage:`, error);
    return false;
  }
};

/**
 * Example: Assign a ticket to a user
 * 
 * Usage:
 * ```
 * import { assignTicket } from './helpdesk_api_examples';
 * 
 * const handleAssign = async (ticketId, userId) => {
 *   const success = await assignTicket(ticketId, userId);
 *   if (success) {
 *     // Ticket assigned successfully
 *     showToast('Ticket assigned successfully');
 *   }
 * };
 * ```
 */
export const assignTicket = async (ticketId, userId) => {
  try {
    // Update only the user_id field
    const success = await updateHelpdeskTicket(ticketId, {
      user_id: userId
    });
    
    return success;
  } catch (error) {
    console.error(`Error assigning ticket ${ticketId}:`, error);
    return false;
  }
};

/**
 * Example: Update multiple ticket fields
 * 
 * Usage:
 * ```
 * import { updateTicket } from './helpdesk_api_examples';
 * 
 * const handleUpdate = async (ticketId, updateData) => {
 *   const success = await updateTicket(ticketId, updateData);
 *   if (success) {
 *     // Ticket updated successfully
 *     navigation.goBack();
 *   }
 * };
 * ```
 */
export const updateTicket = async (ticketId, updateData) => {
  try {
    // Map form field names to API field names if needed
    const mappedData = {};
    
    if (updateData.subject) {
      mappedData.name = updateData.subject;
    }
    
    if (updateData.description) {
      mappedData.description = updateData.description;
    }
    
    if (updateData.priority) {
      mappedData.priority = updateData.priority;
    }
    
    if (updateData.stageId) {
      mappedData.stage_id = updateData.stageId;
    }
    
    if (updateData.userId) {
      mappedData.user_id = updateData.userId;
    }
    
    if (updateData.teamId) {
      mappedData.team_id = updateData.teamId;
    }
    
    if (updateData.tagIds) {
      mappedData.tag_ids = [
        [6, 0, updateData.tagIds] // Magic format for many2many field: [6, 0, ids]
      ];
    }
    
    // Update the ticket with the mapped data
    const success = await updateHelpdeskTicket(ticketId, mappedData);
    
    return success;
  } catch (error) {
    console.error(`Error updating ticket ${ticketId}:`, error);
    return false;
  }
};

/**
 * Example: Log time on a ticket
 * 
 * Usage:
 * ```
 * import { logTimeOnTicket } from './helpdesk_api_examples';
 * 
 * const handleTimeSubmit = async (ticketId, hours, description) => {
 *   const success = await logTimeOnTicket(ticketId, hours, description);
 *   if (success) {
 *     // Time logged successfully
 *     showToast('Time logged successfully');
 *   }
 * };
 * ```
 */
export const logTimeOnTicket = async (ticketId, hours, description) => {
  try {
    // Create timesheet entry
    const timesheetId = await createTicketTimesheet(ticketId, hours, description);
    
    return timesheetId ? true : false;
  } catch (error) {
    console.error(`Error logging time on ticket ${ticketId}:`, error);
    return false;
  }
};

/**
 * Example: Get a ticket with all related data
 * 
 * Usage:
 * ```
 * import { getDetailedTicket } from './helpdesk_api_examples';
 * 
 * const TicketDetailScreen = ({ route }) => {
 *   const { ticketId } = route.params;
 *   const [ticketData, setTicketData] = useState(null);
 *   const [loading, setLoading] = useState(true);
 *   
 *   useEffect(() => {
 *     const loadTicket = async () => {
 *       setLoading(true);
 *       const data = await getDetailedTicket(ticketId);
 *       setTicketData(data);
 *       setLoading(false);
 *     };
 *     
 *     loadTicket();
 *   }, [ticketId]);
 *   
 *   // Render ticket details...
 * };
 * ```
 */
export const getDetailedTicket = async (ticketId) => {
  try {
    // Get the ticket with detailed fields
    const ticket = await getHelpdeskTicket(ticketId, [
      'id',
      'name',
      'description',
      'team_id',
      'user_id',
      'partner_id',
      'partner_name',
      'partner_email',
      'partner_phone',
      'stage_id',
      'priority',
      'create_date',
      'write_date',
      'ticket_ref',
      'sla_deadline',
      'sla_reached',
      'sla_fail',
      'tag_ids',
      'ticket_type_id',
      'use_helpdesk_timesheet'
    ]);
    
    if (!ticket) {
      return null;
    }
    
    // Get related data in parallel
    const [slaStatus, timesheets, attachments] = await Promise.all([
      getTicketSLAStatus(ticketId),
      getTicketTimesheets(ticketId),
      getTicketAttachments(ticketId)
    ]);
    
    // Add related data to the ticket object
    const detailedTicket = {
      ...ticket,
      slaStatus: slaStatus || [],
      timesheets: timesheets || [],
      attachments: attachments || []
    };
    
    return detailedTicket;
  } catch (error) {
    console.error(`Error getting detailed ticket ${ticketId}:`, error);
    return null;
  }
};

/**
 * Example: Load all necessary data for a new ticket form
 * 
 * Usage:
 * ```
 * import { loadTicketFormData } from './helpdesk_api_examples';
 * 
 * const NewTicketScreen = () => {
 *   const [formData, setFormData] = useState(null);
 *   const [loading, setLoading] = useState(true);
 *   
 *   useEffect(() => {
 *     const loadData = async () => {
 *       setLoading(true);
 *       const data = await loadTicketFormData();
 *       setFormData(data);
 *       setLoading(false);
 *     };
 *     
 *     loadData();
 *   }, []);
 *   
 *   // Render form with dropdown options...
 * };
 * ```
 */
export const loadTicketFormData = async () => {
  try {
    // Load all necessary data in parallel
    const [teams, ticketTypes, tags] = await Promise.all([
      getHelpdeskTeams(),
      getHelpdeskTicketTypes(),
      getHelpdeskTags()
    ]);
    
    // Get stages for the first team (if any)
    let stages = [];
    if (teams && teams.length > 0) {
      stages = await getHelpdeskStages(teams[0].id);
    }
    
    return {
      teams: teams || [],
      stages: stages || [],
      ticketTypes: ticketTypes || [],
      tags: tags || [],
      priorities: [
        { id: '0', name: 'Low' },
        { id: '1', name: 'Medium' },
        { id: '2', name: 'High' },
        { id: '3', name: 'Urgent' }
      ]
    };
  } catch (error) {
    console.error('Error loading ticket form data:', error);
    return {
      teams: [],
      stages: [],
      ticketTypes: [],
      tags: [],
      priorities: [
        { id: '0', name: 'Low' },
        { id: '1', name: 'Medium' },
        { id: '2', name: 'High' },
        { id: '3', name: 'Urgent' }
      ]
    };
  }
};

/**
 * Example: Get stages for a specific team (used when team selection changes)
 * 
 * Usage:
 * ```
 * import { getTeamStages } from './helpdesk_api_examples';
 * 
 * const handleTeamChange = async (teamId) => {
 *   setFormData(prev => ({ ...prev, teamId }));
 *   const stages = await getTeamStages(teamId);
 *   setStages(stages);
 * };
 * ```
 */
export const getTeamStages = async (teamId) => {
  try {
    if (!teamId) {
      return [];
    }
    
    const stages = await getHelpdeskStages(teamId);
    return stages || [];
  } catch (error) {
    console.error(`Error getting stages for team ${teamId}:`, error);
    return [];
  }
};

// Export the complete set of functions
export default {
  fetchTicketsForTeam,
  fetchMyTickets,
  fetchFilteredTickets,
  createNewTicket,
  updateTicketStage,
  assignTicket,
  updateTicket,
  logTimeOnTicket,
  getDetailedTicket,
  loadTicketFormData,
  getTeamStages
};
