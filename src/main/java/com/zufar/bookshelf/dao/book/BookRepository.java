package com.zufar.bookshelf.dao.book;

import com.zufar.bookshelf.dao.book.model.Book;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookRepository extends JpaRepository<Book, Long> {
}
