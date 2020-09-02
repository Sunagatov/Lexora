package com.zufar.bookshelf.repository;

import com.zufar.bookshelf.entity.Book;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookRepository extends JpaRepository<Book, Long> {
}
