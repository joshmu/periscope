export function getUserById(id: string) {
  // Mock implementation for testing
  return {
    id,
    name: 'Test User',
    email: 'test@example.com',
  };
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to parse query strings
export function parseQueryString(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = query.split('&');

  pairs.forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key) {
      params[key] = decodeURIComponent(value || '');
    }
  });

  return params;
}
