import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import Home from './page';

test('renders the LanguZe name and tagline', () => {
  render(<Home />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'LanguZe' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Learn from your world.')).toBeInTheDocument();
});
