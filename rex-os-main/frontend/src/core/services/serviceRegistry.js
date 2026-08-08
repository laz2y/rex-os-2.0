import { services } from "../../data/services";

class ServiceRegistry {
  getAll() {
    return services;
  }

  get(id) {
    return services.find((service) => service.id === id);
  }

  getCategory(category) {
    return services.filter(
      (service) => service.category === category
    );
  }
}

export default new ServiceRegistry();