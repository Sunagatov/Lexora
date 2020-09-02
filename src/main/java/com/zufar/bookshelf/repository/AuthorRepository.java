package com.zufar.bookshelf.repository;

import com.zufar.bookshelf.entity.Author;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorRepository extends JpaRepository<Author, Long> {
}