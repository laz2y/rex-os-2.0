class DashboardEngine {
  constructor() {
    this.widgets = [];
  }

  register(widget) {
    this.widgets.push(widget);
  }

  getWidgets() {
    return this.widgets;
  }
}

const dashboardEngine = new DashboardEngine();

export default dashboardEngine;