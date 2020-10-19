package com.zufar.bookshelf.dao.author;

import com.zufar.bookshelf.dao.author.model.Author;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorRepository extends JpaRepository<Author, Long> {
}