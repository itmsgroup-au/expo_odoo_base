# Claude Desktop MCP Templates for ExoMobile

This document contains templates for using Claude Desktop with Machine-Coded Program (MCP) tools to accelerate the development of the ExoMobile application. These templates are designed to be used with Claude Desktop to generate high-quality, consistent code.

## Component Generation Template

Use this template to ask Claude to generate React Native components:

```markdown
# React Native Component Generation

## Component Specifications

- **Name**: [ComponentName]
- **Purpose**: [Brief description of what the component does]
- **Location**: src/components/[category]/[ComponentName].tsx

## Props
```typescript
interface [ComponentName]Props {
  // List required props
  [propName]: [propType]; // [description]
  // List optional props
  [optionalProp]?: [propType]; // [description]
}
```

## Design Specifications
- **Visual Style**: [Material Design / Custom / etc.]
- **Density Support**: [Yes/No]
- **States**: [List states: normal, loading, error, etc.]
- **Animations**: [Describe any animations]

## Behavior
[Describe how the component should behave, including interactions]

## Accessibility Requirements
- aria-label: [Yes/No]
- Keyboard navigation: [Yes/No]
- Screen reader support: [Yes/No]

## Example Usage
```jsx
// Example of how the component will be used
<[ComponentName]
  [prop]={[value]}
  [optionalProp]={[value]}
/>
```

Please generate:
1. The complete component implementation with types
2. A Jest test file for the component
3. A storybook story (if applicable)
```

## Screen Generation Template

Use this template to ask Claude to generate screen components:

```markdown
# React Native Screen Generation

## Screen Specifications

- **Name**: [ScreenName]Screen
- **Purpose**: [Brief description of what the screen does]
- **Location**: src/features/[module]/screens/[ScreenName]Screen.tsx

## Navigation
- **Stack**: [Name of the navigation stack]
- **Params**: 
```typescript
type [ScreenName]ScreenParams = {
  [paramName]: [paramType]; // [description]
};
```

## State Management
- **Redux**: [Yes/No]
- **Local State**: [List local state variables]
- **Context**: [List contexts used]

## API Integration
- **Endpoints Used**: [List API endpoints]
- **Data Loading**: [Describe data loading strategy]
- **Error Handling**: [Describe error handling approach]

## UI Components
- [List main components used in the screen]

## User Interactions
- [Describe key user interactions]

## Example Navigation
```jsx
// Example of how to navigate to this screen
navigation.navigate('[ScreenName]', { [param]: [value] });
```

Please generate:
1. The complete screen implementation with types
2. A Jest test file for the screen
3. Redux actions/selectors if needed
```

## Redux Slice Template

Use this template to ask Claude to generate Redux slices:

```markdown
# Redux Slice Generation

## Slice Specifications

- **Name**: [sliceName]
- **Purpose**: [Brief description of what the slice manages]
- **Location**: src/redux/slices/[sliceName]Slice.ts

## State Interface
```typescript
interface [SliceName]State {
  [property]: [type]; // [description]
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
```

## Initial State
```typescript
const initialState: [SliceName]State = {
  [property]: [defaultValue],
  status: 'idle',
  error: null
};
```

## Thunks
- **[thunkName]**: [Brief description]
  - Parameters: [List parameters]
  - Endpoint: [API endpoint]
  - Success/Failure Actions: [Describe actions]

## Reducers
- **[reducerName]**: [Brief description]
  - Parameters: [List parameters]
  - State Changes: [Describe state changes]

## Selectors
- **select[Something]**: [Brief description]
  - Returns: [Describe return value]

Please generate:
1. The complete Redux slice implementation with types
2. A Jest test file for the slice
3. Example usage in a component
```

## API Service Template

Use this template to ask Claude to generate API service modules:

```markdown
# API Service Generation

## Service Specifications

- **Name**: [serviceName]Api
- **Purpose**: [Brief description of what the service does]
- **Location**: src/api/models/[serviceName]Api.ts

## Odoo Model
- **Model Name**: [odooModelName]
- **Endpoints Used**: [List endpoints]

## Methods
- **[methodName]**: [Brief description]
  - Parameters: [List parameters]
  - Return Type: [Describe return value]
  - Error Handling: [Describe error handling]

## Offline Support
- **Caching Strategy**: [Describe caching approach]
- **Sync Behavior**: [Describe sync behavior]

## TypeScript Interfaces
```typescript
export interface [InterfaceName] {
  [property]: [type]; // [description]
}
```

Please generate:
1. The complete API service implementation with types
2. A Jest test file for the service
3. Example usage in a thunk or component
```

## Complete Module Template

Use this template to ask Claude to generate a complete module:

```markdown
# Complete Module Generation

## Module Specifications

- **Name**: [moduleName]
- **Purpose**: [Brief description of what the module does]
- **Location**: src/features/[moduleName]

## Odoo Integration
- **Model**: [odooModelName]
- **Key Fields**: [List important fields]
- **Relationships**: [Describe relationships with other models]

## Screens
- **[ScreenName]Screen**: [Brief description]
- **[AnotherScreen]Screen**: [Brief description]

## Components
- **[ComponentName]**: [Brief description]
- **[AnotherComponent]**: [Brief description]

## Redux
- **State Structure**: [Describe state structure]
- **Key Actions**: [List important actions]
- **Thunks**: [List thunks]

## API Services
- **[ServiceName]Api**: [Brief description]
- **Methods**: [List key methods]

## Navigation
- **Stack Structure**: [Describe navigation]
- **Routes**: [List routes]

Please generate:
1. The complete module structure with all necessary files
2. Redux slice
3. API service
4. Components and screens
5. Navigation configuration
6. Tests for all components
```

## Test File Template

Use this template to ask Claude to generate test files:

```markdown
# Test File Generation

## Test Specifications

- **Type**: [Unit/Integration/E2E]
- **Target**: [Component/Screen/Service/Slice name]
- **Location**: [Path to test file]

## Testing Goals
- [List what needs to be tested]

## Mocks Needed
- [List mocks required]

## Test Cases
- **[TestCaseName]**: [Brief description]
  - Setup: [Describe setup]
  - Actions: [Describe actions]
  - Assertions: [Describe assertions]

## Mock Data
```javascript
// Sample mock data needed for tests
```

Please generate:
1. The complete test file with all test cases
2. Proper mocks and fixtures
3. Any helper functions needed
```

## Using These Templates with Claude Desktop

1. **Copy and Paste**: Copy the appropriate template and paste it into your conversation with Claude Desktop.

2. **Fill in the Placeholders**: Replace all placeholders like `[ComponentName]` with your actual requirements.

3. **Provide Context**: Add any additional context or requirements specific to the ExoMobile project.

4. **Review and Refine**: Review Claude's output carefully and ask for refinements if needed.

## Example MCP Workflow for Component Creation

1. **Prepare Request**:
   - Fill out the Component Generation Template for a "MainTile" component
   - Include design specifications from the mockups

2. **Generate with Claude**:
   - Send the filled template to Claude Desktop
   - Claude will generate the component, tests, and usage examples

3. **Implement in Project**:
   - Use MCP filesystem tools to create the necessary files
   - Add the generated code to the project
   - Make any necessary adjustments

4. **Test and Refine**:
   - Run tests for the new component
   - Ask Claude for refinements if needed
   - Integrate the component into the app

By using these templates with Claude Desktop, you can accelerate development while maintaining consistent code quality and structure throughout the ExoMobile project.
