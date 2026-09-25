import { Component } from 'react';

class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-500">
            This page could not be displayed. Reload and try again.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-2xl bg-maroon-800 px-5 py-3 text-sm font-semibold text-white hover:bg-maroon-900"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
