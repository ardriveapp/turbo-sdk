import { render, screen } from '@testing-library/react';

import Home from './page';

describe('Home', () => {
  it('renders the file upload interface', () => {
    render(<Home />);

    const heading = screen.getByRole('heading', {
      name: /File Upload with Turbo SDK/i,
    });
    expect(heading).toBeInTheDocument();
  });
});
