package com.zufar.bookshelf.repository;

import com.zufar.bookshelf.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Long> {
}
