class UserDto {
  id?: string | undefined;
  email: string;
  name: string;
  role?: string | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;

  constructor(model: {
    id?: string;
    email: string;
    name: string;
    role?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
  }) {
    this.id = model.id;
    this.email = model.email;
    this.name = model.name;
    this.role = model.role;
    this.createdAt = model.createdAt;
    this.updatedAt = model.updatedAt;
  }
}

export default UserDto;
